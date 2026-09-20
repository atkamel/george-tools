// Use the bare host. The www. host answers 301 and a client that follows it
// turns the POST into a GET, so george replies "Empty input.".
export const BASE_URL = "https://student.cs.uwaterloo.ca";
export const CHECK_URL = `${BASE_URL}/~se212/george/ask-george/cgi-bin/george.cgi/check`;
export const FILES_INDEX_URL = `${BASE_URL}/~se212/files.json`;
export const COURSE_ROOT = `${BASE_URL}/~se212`;
/** Any SSO-gated file works as a login probe. Assignment 0 is always present. */
export const LOGIN_PROBE_URL = `${COURSE_ROOT}/asn/a00/a00q01.grg`;
/** The web UI refuses uploads above this size. */
export const MAX_FILE_BYTES = 200 * 1024;
/** The web UI waits this long for a reply. */
export const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;
/** The cookie mellon sets once the UWaterloo sign-in succeeds. Pasted by hand for `login --cookie`. */
export const MELLON_COOKIE_NAME = "mellon-student.cs.uwaterloo.ca";
/** The web UI waits this long for a reply. */
export const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;
