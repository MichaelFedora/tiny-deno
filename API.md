# API

## Auth

## File

## DB

## Extensions

### Gaia

### WebFinger

It's fairly straightforward:

- **`GET /.well-known/webfinger`** to run the WebFinger request
  - `?resource={username}@{domain}` will either search for the user if the domain is local, or redirect to
    `https://{domain}/.well-known/webfinger?resource={username}@{domain}` if the domain is remote
  - `?resource={username}-{app}@{domain}` will search for the user and retrieve only the aliases and links that
  belong to the specified app
  - `?resource={secure-hash}-secure@{domain}` will search for the user *by the hash* and retrieve only the
  aliases and links that belong to the specified hash
- **`PUT /.well-known/webfinger`** **with an authorized session** to store WebFinger information for the
  authorized application or for the root user
  - You must give the entire body -- partial updates are not allowed, and if the array is empty it will remove
  the information completely.

### Activity Pub

None.
