# KAT for Schools, WordPress example

A single-file drop-in that connects a WordPress site to KAT:

- **Magic-link SSO** (`[kat_classroom]`): the signed-in pupil's lessons, embedded in your own page, with no second password.
- **Roster sync** (`kat_sync_roster()`): push your class list to KAT on a schedule or from your enrolment form.
- **Progress** (`[kat_progress]`, `kat_get_progress()`): read a pupil's progress into your own portal.

Everything runs on the WordPress server. The API key never reaches a browser.

## Install

1. Copy `kat-for-schools.php` into `wp-content/mu-plugins/` (loads automatically) or `wp-content/plugins/` (then activate it).
2. Add to `wp-config.php`, above the "stop editing" line:
   ```php
   define( 'KAT_API_KEY',     'kat_sk_live_xxxxxxxx' ); // secret, from the KAT dashboard
   define( 'KAT_SCHOOL_SLUG', 'your-school' );          // the slug in your embed URL
   // define( 'KAT_BASE_URL', 'https://schools.kindleatechie.com' ); // optional, this is the default
   ```
3. In the KAT dashboard, add this site's exact origin (e.g. `https://yourschool.com`) to the school's allowed embed origins. Without it the lesson iframe is blocked.

## The one thing you wire up

Map each WordPress user to their KAT pupil reference. When you sync a roster, store the ref on the user:

```php
update_user_meta( $wp_user_id, 'kat_external_ref', 'STU-0417' );
```

The shortcodes read that meta to know which pupil is asking. Never take the ref from a URL or a form field.

## Notes

- **Learner-only.** There is no teacher embed by design: a teacher screen shows a roster of minors, so it is never framed on a page KAT does not control. Teachers use the KAT dashboard directly.
- **Do not cache** a page carrying `[kat_classroom]`. The launch token is minted per render and lives 60 seconds.
- **Safari / strict privacy settings** may block the frame's cookie. When that happens the frame shows an "Open my lessons" button that opens the same lesson in a first-party tab.
- The **canonical, field-by-field spec** is the web page, not this example: <https://kindleatechie.com/schools/developers>. If anything here disagrees with the page, the page is right.
