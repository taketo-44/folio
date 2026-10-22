// Both hosted and loopback UIs use local scripts; Crossref is the only browser API.
export function securityHeaders(res,https=false){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Referrer-Policy','same-origin');
 res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.crossref.org; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'");
 if(https)res.setHeader('Strict-Transport-Security','max-age=31536000');
}
