# API

The API documentation for a Tiny node.

## Root Features

Root features land under the root api route, without needing a context scope.

### Core

Core features land under the root api route, and are as follows:

- GET `/type` - Returns the type of node, which can be `home`, `file`, or `db`.
- GET `/self/avatar?` - Returns null if unauthenticated, or the user object if authenticated
  - If an app, also returns app data (such as preferred nodes, if the node is a home)
  - If avatar is specified, instead return your avatar image
- DELETE `/self`
  - If an app, deletes app data
  - If a user, deletes all user data -- requires a password string in the text body to confirm
- DELETE `/self/avatar` - As a user, delete your avatar
- GET `/users/:username/avatar?` - Get a user's public information, or if `avatar` is specified, just the user's avatar

### Auth

All URLs land under the `/auth` parent route, e.x.:

- `POST /auth/login`
- `GET /auth/handshake/start`

The routes are as follows:

Core:

- POST `/login` - Post with a body of `{ username: string; password: string }` and either get a 403 or a session
- POST `/register` - Post with a body of `{ username: string; password: string }` and get a 401 or a 204.
- GET `/can-register` - Returns a 204 or 403 as to whether or not registrations are open on this node.
- POST `/change-pass` - Post with a body of `{ username: string; password: string; newpass: string }`
  and either get a 403 or a 204.
- GET `/sessions` - Receives a list of active sessions
- DELETE `/session/:id?` - Revoke all or one session via an ID
- GET `/apps`
  - If a user, gets a list of connected apps, and, if a home, their preferred file and db storage nodes
  - If an app, get only a list containing your information
- DELETE `/apps/:id` - as a User, delete an app and it's information. If the query parameter `?soft` is specified,
  then just remove its saved configuration, but keep the data.
- POST `/logout` - Logout of the currently authorized session
- GET `/refresh` - Refresh the current session - revokes the old session and returns a new ID

Handshakes:

- GET `/handshake/start` - Start a handshake by redirecting to this route with the `?app={appId}&redirect={redirectUrl}` params
  - Optionally, `collections` and `permissions` parameters can be added as well.
- POST `/handshake/complete` - Finish a handshake by posting `{ app, redirect, code, collections?, permissions? }` to this route
  and getting a session back (if they matched the initial handshake parameters + the returned code correctly)
- GET `/handshake/:id` - As a user, get handshake information
- POST `/handshake/:id/(approve|cancel)` - As a user, approve or cancel the handshake and be given back a url
to redirect to.

Master Keys:

- GET `/master-key/:id?` - Get all or get one master key via an ID
- POST `/master-key` - Add a master-key to the Tiny node
  - For a dedicated node, the body can be empty or have a `{ name: string }` object and will return a text body of
  the master key id
  - For a home node, the body must be an `{ key: string, url: string, type: 'file' | 'db', name?: string }` object, and will return a 204
- PUT | DELETE `/master-key/:id` - Update the master key with a body of `{ name: string }`, or remove a master-key
- POST `/master-key/:id/generate-session` - Use a master-key to generate a session (on a dedicated node)

## Scoped Features

Scoped features land under the `/:feature/:context/:identifier` route, with:

- `:feature` being the feature id or name
- `:context` is `user`, `secure`, or an app domain (i.e. `app.co` or `example.app`).
- `:identifier` is a username if the context is `user` or an app domain,
or a secure hash if the context is `secure`.

For example:

- `GET /files/user/john.smith/public/profile/avatar.png` has a `user` context and references `john.smith`, and
  so will query john.smith's global public profile avatar, found under `/public/profile/avatar.png`
- `GET /db/cool.app/BobTest/dynamic/graphql?query={+shoppingCart{+items+{+id,+name,+price+},+quantity+}+}`
  has a `cool.app` context and references `BobTest`, and so will use BobTest's cool.app dynamic database
  to run a graphql query on

If `context` or `identifier` is a `~`, then assume it from the given session, so calling routes like
`GET /files/~/~/private/config.json` and `GET /files/~/bob.test/public/posts/1.json` is simpler from an app.

### File

All URLs land under the `/files/:context/:identifier` parent route, e.x.:

- `GET /files/app.co/john.smith/public/notes/1.json`
- `DELETE /files/user/BobTest/root/appdata/cool.app/blob.json`

Paths are created with a Root Identifier and then the path itself. Root Identifiers can be one of three types:

- `public` is the public folder of the context;
  - For apps, it's `/public/appdata/{app domain}`
  - For secure apps, it's `/public/appdata/secure/{hash}`
  - For users, it's `/public`
- `private` is the private folder of the context:
  - For apps, it's `/appdata/{app domain}`
  - For secure apps, it's `/appdata/secure/{hash}`
  - For users, it's `/private`
- `root` is the root accessor, which is always `/`
- `collections` is the collection accessor, which will be `/collections/{path}`

The routes are as follows:

- GET | PUT | DELETE `/:root(public|private|root|collections)/:path(.+)`
  - GET to read the file
  - PUT to write (over) a file
  - DELETE to remove a file
- GET `/list-files/:path(.*)?` - List file paths for the context container
  - Optionally define a path to list the files under
  - Use `?page={number}` to navigate to a particular page
  - Use the `?advance=true` query to return file metadata instead of just path names
- GET `/storage-stats` - Get the storage stats for the context container
  - Returns `{ user: number, available?: number, max?: number }`, with each value being the number of bytes
- POST `/batch-info` - Get information for the file paths listed in the json (as relative to the context)
  - Should be given a JSON string array
  - Can be accessed without an authorized session, but will only return information under the `public` folder
  - Returns a list of file metadata (similar to `/list-files?advance=true`)

### DB

All URLs land under the `/db/:context/:identifier` parent route, e.x.:

- `GET /db/app.co/john.smith/dynamic/graphql?query={hello}`
- `PUT /db/user/BobTest/key-value/store/foo`

#### Key-Value DB

The Key-Value DB was the initial database store made for the Tiny suite, which simply gives access to a persistent
simple storage through a REST like API.

- GET | PUT | DELETE `/key-value/store/:key`
  - GET to get the value for the given key
  - PUT to set the value
  - DELETE to remove the value from the store
- POST `/key-value/store` - Add an object to the store with a unique key (value must be an object)
- POST `/key-value/search` - Search the store given a search query object
- POST `/key-value/batch` - Batch PUT / DELETE actions on the store

#### Dynamic DB

The Dynamic DB was added to create some more flexibility and type structure for app databases, along with easier querying
and storage for complicated objects.

- GET | PUT | DELETE `/dynamic/tables/:name`
  - GET to get the schema of a table
  - PUT to update/replace the schema of a table (keeps the data if fields are the same)
  - DELETE to drop a table
- GET | POST | DELETE `/dynamic/tables`
  - GET to get all the schemas of the dynamic db
  - POST to add a table
  - DELETE to drop all tables
- GET | POST `/dynamic/graphql`
  - Interact (query, mutation, etc.) with the database using graphql

The GraphQL schema is as follows:

```graphql
# Tiny-defined Global Types

# A javascript Date
type Date

# Always null
type Void

# Any
type JSON

# A batch option
enum Operation { add, put, del }

# Options to use in a search query
input SearchOptions {
  start: String
  end: String
  skip: Int
  limit: Int
  query: JSON
  projection: [String]
  sort: String
}

# Passed as a stub type -- we're not defining this right now
type ChildType {
  id: ID!
  value: JSON
}

###

# The type we are defining
type Type {
  # This is always present, regardless if its in your passed schema or not,
  # and it will always be an `ID!` type
  id: ID!

  # Some sample fields
  child: Child
  foo: Boolean
  counter: Int!
}

# The generated input type
input TypeInput {
  # Takes an ID instead of an entire object
  child: ID
  # Same as usual
  foo: Boolean
  # Doesn't keep the required flag
  counter: Int
}

# The generated batch input type
input TypeBatchInput {
  type: Operation!
  id: ID!
  value: TypeInput
}

# The generated batch return type
type TypeBatchReturn {
  type: Operation!
  id: ID!
  value: Type
}

# Generated Queries
type Query {
  # Get many items (or all items)
  types(search: SearchOptions): [Type]!
  # Get one item
  type(id: ID!): Type
}

# Generated Mutations
type Mutation {
  # Batch puts/deletes
  batchType(input: [TypeBatchInput]!): [TypeBatchReturn]!
  # Add an item
  addType(input: TypeInput!): Type!
  # Update an item
  putType(id: ID!, input: TypeInput!): Type!
  # Delete an item
  delType(id: ID!): Void
}

# Generated Subscriptions (currently unimplemented)
type Subscription {
  # Subscribe to the type, or reduce it to a singular item of the type / an operation on that type
  type(id: ID, op: Operation): Type
}

```

## Extensions

### Gaia

As required by the Gaia implementation spec, with the read url being under `/gaia/read/:address/:path(.+)`.
Association Tokens are required so the node knows where to store the data. User Addresses must be registered
to a user on the node before using as there is no way to do auto-registration.

Files are stored under `/{user}/gaia/{address}/{...path}` directory.

- HEAD | GET `/gaia/read/:address/:path(.+)`
- GET `/gaia/hub_info`
- POST `/gaia/store/:address/:path(.+)`
- DELETE `/gaia/delete/:address/:path(.+)`
- POST `/gaia/revoke-all/:address`
- POST `/gaia/list-files/:address`

### WebFinger

It's fairly straightforward:

- GET `/.well-known/webfinger` to run the WebFinger request
  - `?resource={username}@{domain}` will either search for the user if the domain is local, or redirect to
    `https://{domain}/.well-known/webfinger?resource={username}@{domain}` if the domain is remote
  - `?resource={username}-{app}@{domain}` will search for the user and retrieve only the aliases and links that
  belong to the specified app
  - `?resource={secure-hash}-secure@{domain}` will search for the user *by the hash* and retrieve only the
  aliases and links that belong to the specified hash
- PUT `/.well-known/webfinger` **with an authorized session** to store WebFinger information for the
  authorized application or for the root user
  - You must give the entire body -- partial updates are not allowed, and if the array is empty it will remove
  the information completely.
  - A User session *may* specify other contexts via `?context={context}&identifier={identifier}`, with `identifier`
  only being required if the context is `secure`.

### Activity Pub

Not yet implemented.

### Friends

Not yet implemented.

Draft:

- GET `/friends` - Get friends
- GET `/friends?of` - Get users who have you as a friend
- GET `/friends/:username` - Get a user's friends
- GET `/friends/:username?of` - Get users who have the specified user as a friend
- POST `/friends/:username` - Add a friend
- DELETE `/friends/:username` - Remove a friend
- PUT `/friends/notify` - Adjust whether or not you want notifications for friendship changes
