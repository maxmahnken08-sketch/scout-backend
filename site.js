// Scout marketing landing page — served at GET /.
// The page lives as a standalone HTML file (landing.html) so the rich markup,
// CSS and JS stay editable without template-literal escaping. Read once at boot.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
export const landingHTML = readFileSync(path.join(here, 'landing.html'), 'utf8');
