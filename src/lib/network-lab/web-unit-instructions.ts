/**
 * Instruction copy for the web unit (dns01, http01), Primary 5-6 and SS1 variants.
 *
 * This is AUTHORING SOURCE, not a runtime switch. Per the resolved content approach
 * (src/lib/network-lab/CLAUDE.md): Network Lab instructions are ordinary RICH_TEXT LessonContent
 * blocks, and Primary vs SS1 is handled by WHICH curriculum a level's lesson sits in, not a
 * content-level toggle. So each level here has two authored versions; curriculum staff paste the
 * matching one into the RICH_TEXT block of the Primary lesson or the SS1 lesson. It is NOT read by
 * the engine or the block, and it is deliberately not MDX.
 *
 * Basic HTML only (the content editor sanitises it). KAT voice, Nigerian device names, no external
 * brand names.
 */

export type WebUnitTrack = "primary" | "sss";

export const WEB_UNIT_INSTRUCTIONS: Record<"dns01" | "http01", Record<WebUnitTrack, string>> = {
  dns01: {
    primary: `<h3>Finding the address</h3>
<p>Computers do not reach each other using names like <strong>katlearning</strong>. They use numbers, called addresses.</p>
<p>So Chinagorom cannot reach <strong>katlearning</strong> straight away. First he asks the DNS server, "what is the number for katlearning?" The DNS server writes back with the address.</p>
<ul>
<li>Send a <strong>dns_query</strong> to the DNS server, with the name <strong>katlearning</strong>.</li>
<li>Read the answer. The address is <strong>10.0.0.5</strong>.</li>
<li>Now send your packet to <strong>10.0.0.5</strong>.</li>
</ul>`,
    sss: `<h3>DNS: names to addresses</h3>
<p>Every site has a name people can remember and an address machines actually use. The Domain Name System (DNS) is the phone book that maps one to the other.</p>
<p>Chinagorom cannot connect to <strong>katlearning</strong> by name. The steps are:</p>
<ul>
<li><strong>Resolve.</strong> Send a <code>dns_query</code> for <strong>katlearning</strong> to the DNS server. It replies with a <code>dns_answer</code> holding the address <strong>10.0.0.5</strong>.</li>
<li><strong>Connect.</strong> Send your real packet to <strong>10.0.0.5</strong>.</li>
</ul>
<p>The lookup always comes before the connection. That is why a slow DNS makes the whole web feel slow.</p>`,
  },
  http01: {
    primary: `<h3>Asking a server for a page</h3>
<p>The web works by asking and answering. Amaka's computer asks the server for a page, and the server sends the page back.</p>
<ul>
<li>Send an <strong>http_request</strong> to <strong>katlearning.ng</strong>.</li>
<li>The server sends an <strong>http_response</strong> back to you.</li>
</ul>
<p>That back and forth happens every time you open a web page.</p>`,
    sss: `<h3>HTTP: request and response</h3>
<p>A browser is a client. A website runs on a server. They speak HTTP: the client sends an <code>http_request</code>, the server returns an <code>http_response</code>.</p>
<ul>
<li>Amaka sends an <code>http_request</code> to <strong>katlearning.ng</strong>.</li>
<li>The server answers with an <code>http_response</code>, which travels back through the router to Amaka.</li>
</ul>
<p>Later you will see why someone listening on the path can read a plain request, and how HTTPS hides it.</p>`,
  },
};
