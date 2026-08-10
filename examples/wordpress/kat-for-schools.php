<?php
/**
 * Plugin Name: KAT for Schools
 * Description: Sign pupils into their KAT lessons from your own site (magic-link SSO), sync your
 *              roster to KAT, and read pupil progress. All server-side. No API key ever reaches a browser.
 * Version:     1.0.0
 * Author:      Kindle A Techie
 *
 * ---------------------------------------------------------------------------------------------------
 * DROP-IN INSTRUCTIONS
 *
 * 1. Put this file in one of:
 *      wp-content/mu-plugins/kat-for-schools.php   (loads automatically, cannot be deactivated)
 *      wp-content/plugins/kat-for-schools.php       (then activate it under Plugins)
 *
 * 2. Add three lines to wp-config.php, ABOVE the "That's all, stop editing" comment:
 *      define( 'KAT_API_KEY',     'kat_sk_live_xxxxxxxx' ); // secret. from your KAT dashboard.
 *      define( 'KAT_SCHOOL_SLUG', 'your-school' );          // the slug in your embed URL.
 *      define( 'KAT_BASE_URL',    'https://schools.kindleatechie.com' ); // optional. this is the default.
 *
 * 3. In the KAT dashboard, add THIS site's exact origin (e.g. https://yourschool.com) to the
 *    school's allowed embed origins. Until you do, the lesson iframe will not load anywhere.
 *
 * Then:
 *   [kat_classroom]  on a members-only page  -> the signed-in pupil's lessons, embedded.
 *   [kat_progress]   anywhere                 -> a one-line progress summary for the signed-in pupil.
 *   kat_sync_roster( $class_id, $students )    from your enrolment code or a cron job.
 *
 * The one thing you must wire up yourself: map each WordPress user to their KAT pupil reference.
 * When you sync the roster, store the ref on the user:
 *   update_user_meta( $wp_user_id, 'kat_external_ref', 'STU-0417' );
 * The shortcodes read that meta to know which pupil is asking. Never take the ref from a URL or a
 * form field, or a signed-in pupil could open another child's classroom.
 * ---------------------------------------------------------------------------------------------------
 *
 * The full field-by-field spec (the source of truth) lives at:
 *   https://kindleatechie.com/schools/developers
 * This file is a working example. If a field here ever disagrees with that page, the page is right.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // No direct access.
}

if ( ! defined( 'KAT_BASE_URL' ) ) {
	define( 'KAT_BASE_URL', 'https://schools.kindleatechie.com' );
}

/**
 * A key is required for everything. If it is missing, warn in the admin and do nothing else, rather
 * than firing keyless requests that all 401.
 */
function kat_is_configured() {
	return defined( 'KAT_API_KEY' ) && KAT_API_KEY && defined( 'KAT_SCHOOL_SLUG' ) && KAT_SCHOOL_SLUG;
}

add_action( 'admin_notices', function () {
	if ( kat_is_configured() || ! current_user_can( 'manage_options' ) ) {
		return;
	}
	echo '<div class="notice notice-warning"><p><strong>KAT for Schools</strong> is not configured. '
		. 'Add <code>KAT_API_KEY</code> and <code>KAT_SCHOOL_SLUG</code> to wp-config.php.</p></div>';
} );

/**
 * One request against the KAT API. Runs on the server only. The key is sent as a Bearer token and
 * never leaves this process.
 *
 * @return array{status:int,body:array}|WP_Error
 */
function kat_api_request( $method, $path, $body = null, $extra_headers = array() ) {
	if ( ! kat_is_configured() ) {
		return new WP_Error( 'kat_unconfigured', 'KAT_API_KEY / KAT_SCHOOL_SLUG are not set.' );
	}

	$headers = array_merge( array(
		'Authorization' => 'Bearer ' . KAT_API_KEY,
		'Accept'        => 'application/json',
	), $extra_headers );

	$args = array(
		'method'  => $method,
		'headers' => $headers,
		'timeout' => 20,
	);

	if ( null !== $body ) {
		$args['headers']['Content-Type'] = 'application/json';
		$args['body']                    = wp_json_encode( $body );
	}

	$res = wp_remote_request( rtrim( KAT_BASE_URL, '/' ) . $path, $args );
	if ( is_wp_error( $res ) ) {
		return $res;
	}

	return array(
		'status' => (int) wp_remote_retrieve_response_code( $res ),
		'body'   => json_decode( wp_remote_retrieve_body( $res ), true ) ?: array(),
	);
}

/**
 * The KAT pupil reference for the current WordPress user, or null. This is YOUR mapping, stored when
 * you sync the roster (see kat_sync_roster). It is the only handle that identifies a pupil to KAT.
 */
function kat_current_external_ref() {
	$user_id = get_current_user_id();
	if ( ! $user_id ) {
		return null;
	}
	$ref = get_user_meta( $user_id, 'kat_external_ref', true );
	return $ref ? $ref : null;
}

/* ===================================================================================================
 * 1) MAGIC-LINK SSO: the pupil's lessons, embedded in your site.
 * ================================================================================================ */

/**
 * Mint a 60-second, single-use launch token for one pupil. Server-side only: this call, with your
 * key, can open a session as any pupil at your school, so it must never run in a browser.
 *
 * @return string|null the token, or null on any failure.
 */
function kat_mint_launch_token( $external_ref ) {
	$res = kat_api_request( 'POST', '/api/school/embed/token', array(
		'ref'     => $external_ref,
		'purpose' => 'learn',
	) );

	if ( is_wp_error( $res ) || 200 !== $res['status'] || empty( $res['body']['token'] ) ) {
		// 401 key problem, 404 no active pupil with that ref, 429 rate limited.
		$detail = is_wp_error( $res ) ? $res->get_error_message() : wp_json_encode( $res );
		error_log( 'KAT mint failed: ' . $detail );
		return null;
	}
	return $res['body']['token'];
}

/**
 * [kat_classroom] renders the lesson iframe for the signed-in pupil. Put it on a members-only page,
 * and do not cache that page: the token is minted per render and lives 60 seconds.
 */
function kat_classroom_shortcode() {
	if ( ! is_user_logged_in() ) {
		return '<p>Please sign in to open your classroom.</p>';
	}

	$ref = kat_current_external_ref();
	if ( ! $ref ) {
		return '<p>Your account is not linked to KAT yet. Please ask your teacher.</p>';
	}

	$token = kat_mint_launch_token( $ref );
	if ( ! $token ) {
		return '<p>Could not open the classroom right now. Please try again shortly.</p>';
	}

	// The token rides in the URL FRAGMENT (after #), never a query string. A fragment is never sent
	// to a server, so the token stays out of access logs, Referer headers, and page analytics.
	$src = sprintf(
		'%s/embed/%s#t=%s',
		rtrim( KAT_BASE_URL, '/' ),
		rawurlencode( KAT_SCHOOL_SLUG ),
		rawurlencode( $token )
	);

	return sprintf(
		'<iframe src="%s" style="width:100%%;height:80vh;border:0;border-radius:12px" '
			. 'allow="fullscreen; camera; microphone" referrerpolicy="no-referrer" title="Classroom"></iframe>',
		esc_url( $src )
	);
}
add_shortcode( 'kat_classroom', 'kat_classroom_shortcode' );

/* ===================================================================================================
 * 2) ROSTER SYNC: push your class list to KAT.
 * ================================================================================================ */

/**
 * Sync one class roster. New pupils are created, returning pupils are reactivated, and (only if you
 * pass $deactivate_missing) pupils left off the list are deactivated. KAT never hard-deletes a pupil.
 *
 * Always sends an Idempotency-Key, so a retry after a dropped connection replays the first response
 * instead of creating every child a second time or double-counting a seat.
 *
 * @param string $class_id   a KAT class id, from GET /api/v1/classes.
 * @param array  $students   list of [ 'student_id' => string, 'name' => string, 'guardian_email' => string? ].
 * @param bool   $deactivate_missing  deactivate pupils not in $students. Refused above 20% unless $force.
 * @param bool   $force      confirm a large (>20%) deactivation.
 * @return array|WP_Error    { created, reactivated, skipped, deactivated, errors, seats:{used,limit} }
 */
function kat_sync_roster( $class_id, array $students, $deactivate_missing = false, $force = false ) {
	$payload = array(
		'class_id'           => $class_id,
		'students'           => array_values( $students ),
		'deactivate_missing' => (bool) $deactivate_missing,
		'force'              => (bool) $force,
	);

	// Key derived from the payload, NOT the date: a retry of the same roster replays; a changed
	// roster (a pupil added, a name fixed) is a new key that applies on its own. A date-based key
	// would collide on a same-day change and 422 (idempotency_key_reuse), failing the sync silently.
	$idempotency_key = 'roster-' . hash( 'sha256', wp_json_encode( $payload ) );

	$res = kat_api_request(
		'POST',
		'/api/v1/roster',
		$payload,
		array( 'Idempotency-Key' => $idempotency_key )
	);

	if ( is_wp_error( $res ) ) {
		return $res;
	}
	if ( 200 !== $res['status'] ) {
		// 401 unauthorized, 403 missing ROSTER_WRITE scope, 404 class not found,
		// 409 the 20% safety valve (send $force), 422 over seats / invalid payload.
		return new WP_Error( 'kat_roster', 'Roster sync failed (' . $res['status'] . ').', $res['body'] );
	}

	return $res['body'];
}

/**
 * Example daily cron. Wire your own roster source into the `kat_roster_for_sync` filter, returning
 * [ $class_id => [ [ 'student_id' => …, 'name' => … ], … ] ], and remember to store each ref on the
 * matching WordPress user with update_user_meta( $wp_user_id, 'kat_external_ref', $student_id ).
 */
add_filter( 'cron_schedules', function ( $s ) {
	if ( ! isset( $s['daily'] ) ) {
		$s['daily'] = array( 'interval' => DAY_IN_SECONDS, 'display' => 'Once daily' );
	}
	return $s;
} );

add_action( 'init', function () {
	if ( kat_is_configured() && ! wp_next_scheduled( 'kat_daily_roster_sync' ) ) {
		wp_schedule_event( time() + HOUR_IN_SECONDS, 'daily', 'kat_daily_roster_sync' );
	}
} );

add_action( 'kat_daily_roster_sync', function () {
	// Returns [ class_id => students[] ]. Empty by default: fill it from YOUR system.
	$rosters = apply_filters( 'kat_roster_for_sync', array() );
	foreach ( $rosters as $class_id => $students ) {
		if ( empty( $students ) ) {
			continue;
		}
		$result = kat_sync_roster( $class_id, $students );
		if ( is_wp_error( $result ) ) {
			error_log( 'KAT roster sync failed for ' . $class_id . ': ' . $result->get_error_message() );
		}
	}
} );

/* ===================================================================================================
 * 3) READ PROGRESS: for a parent portal or a teacher summary on your own site.
 * ================================================================================================ */

/**
 * One pupil's progress. $external_ref is your own student_id.
 *
 * @return array|null  { student_id, name, status, class_id, course_id,
 *                       lessons_total, lessons_completed, percent_complete, units:[...] }
 */
function kat_get_progress( $external_ref ) {
	$res = kat_api_request( 'GET', '/api/v1/students/' . rawurlencode( $external_ref ) . '/progress' );
	if ( is_wp_error( $res ) || 200 !== $res['status'] ) {
		return null; // 404 = no pupil with that student_id at this school.
	}
	return $res['body'];
}

/**
 * [kat_progress] shows a one-line summary for the signed-in pupil.
 */
function kat_progress_shortcode() {
	$ref = kat_current_external_ref();
	if ( ! $ref ) {
		return '';
	}
	$p = kat_get_progress( $ref );
	if ( ! $p ) {
		return '';
	}
	return sprintf(
		'<p>%d%% complete (%d of %d lessons).</p>',
		(int) ( $p['percent_complete'] ?? 0 ),
		(int) ( $p['lessons_completed'] ?? 0 ),
		(int) ( $p['lessons_total'] ?? 0 )
	);
}
add_shortcode( 'kat_progress', 'kat_progress_shortcode' );
