[build]
  functions = "netlify/functions"
  publish = "."

[functions]
  node_bundler = "esbuild"

# Clean API routes
[[redirects]]
  from = "/api/upload"
  to   = "/.netlify/functions/upload"
  status = 200
  force  = true

[[redirects]]
  from = "/api/guides/:slug"
  to   = "/.netlify/functions/delete"
  status = 200
  force  = true

[[redirects]]
  from = "/api/guides"
  to   = "/.netlify/functions/list"
  status = 200
  force  = true

# Serve hosted walkthroughs from Blobs
[[redirects]]
  from = "/guides/*"
  to   = "/.netlify/functions/serve"
  status = 200
  force  = true

# Allow embedding everywhere
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options          = "ALLOWALL"
    Content-Security-Policy  = "frame-ancestors *"
    Access-Control-Allow-Origin = "*"
