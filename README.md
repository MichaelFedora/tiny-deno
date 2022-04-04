# Tiny Deno

## A federated web-app backend

This is a giant repository of all the `tiny` suite v2+ backend software.

## Still in progress

This software is still in progress, so please pardon the dust.

## Goals

A tiny software to (help) run a multi-user database and/or files node.

In a nutshell, The `tiny` suite is made to be a federated Firebase[^1]: a backend for applications which
find themselves living on the web, but still need a persistent storage that is independent of the accessor,
both in the form of file storage and a database.

There are two definite types of nodes:

- **Dedicated Nodes** - Nodes that run a slimmed down version of Authentication and either a **File** or
  a **DB** feature. These are used to help offset the load on a Home node, or for users to either use a dedicated
  node from their Home node, or for users to host a dedicated node while using a federated Home node.
- **Home Nodes** - Nodes that run every core feature *but optionally have a **File** and **DB***
  *handlers which only redirect to dedicated nodes*.

There are a couple primary features of a Tiny node, and a couple of extensions that can be added on to Home nodes,
which are listed below.

## Core Features

These are the core features of a Tiny Hub, which should all be implemented for a **Home** node, but
you could also make a dedicated **File** node and a dedicated **DB** node as separate dedicated
nodes as specified above.

### Auth

Authentication is required on every node, as users and applications need ways to authenticate and have
their authentication tested.

On dedicated nodes, there is the core login/logout feature, as well as the ability to generate keys for Home nodes
to generate sessions on-the-fly, and the handshake feature for applications to run through.

Home nodes have the same feature set in general, but instead of generating keys they use them within the handshake
process.

#### Login / Logout

A user can login / logout using their username + password combination, which generates a user-scoped session,
allowing them to access everything. **Applications should not use this unless they need[^2] root / administrative
access to files or databases**.

#### Master Keys

Dedicated nodes can generate master keys for Home nodes to use to generate sessions on-the-fly. Think of it as
a mini handshake, which, when an app is finalizing the handshake process, the Home node requests a session from
the dedicated node with the master key, and the dedicated node returns with a session.

Home Nodes *cannot generate master keys*, but can store and use them to create sessions from dedicated nodes.

#### Handshakes

Applications run through a handshake process in order to get an authenticated session from a node. Generally it
starts with an application redirecting to `/auth/handshake/start` with different parameters put in the query,
similar to an OAuth flow. The user will be prompted to login if they aren't already, and then asked if they
would like to authenticate the application which started the handshake, with a preview of what access
the app is requesting. Once complete, the application can end the handshake with a POST request to
`/auth/handshake/complete` containing different information they used to start the handshake, as well as
they code they were given in the redirect back from the node, which will give them their list of sessions and
endpoints to use for storage and such.

### File

For apps to be able to read and write files, persistently, as well as to list them and their information.

There are both private and public folders for app data, as well as collections.

Every app gets a public folder (e.x. `/files/~/~/public/...`) which is publicly readable by everyone -- but not publicly
indexed, and so should be used for hosting images, posts, or other public content, possibly with an `index.json` file at
the root. The private folder (e.x. `/files/~/~/private/...`) should be used for internal files, like configurations.

Collections are shared between all apps, secure or otherwise, but as they are not publicly accessible they are generally used for
cross-app shared data, such as images, documents, or other data fragments. Apps only have read access to the collection in total,
but have write access to their own subfolder (e.x. `/files/~/~/collections/images/my-app`). All authenticated apps have access
to index these collections as well, but (obviously) only if they have access to that collection.

### DB

For apps to be able to store key-value entries and access them via a REST Api, as well as
to create dynamic tables and access them via GraphQL.

### Inboxes

For apps to be able to have some sort of server-side logic triggered by certain requests by the public.

#### Inbox

A general custom-api route which only allows GETs by an authenticated session, and the general public can POST.
The custom logic should define how the general public interacts with the inbox (such as authorization) and
what the server should do with the given data.

The POST requests to the inbox **MUST** contain a JSON body, and the body **MUST** be under 1mb.

The logic for this route is defined by the application, and they must follow the security rules for custom
routes.

#### Outbox

Same as an Inbox, except reverse: only an authenticated session can POST, and the general public can GET.

### Custom API Routes **(NYI)**

*This feature is not yet implemented.*

**This is only available for Secure contexts.**

Secure apps can create custom API routes to do complex file and database mutations without
having to go back and forth with the client.

## Extensions

There are some extensions that a node can run in addition to the core feature set, but they are
not required (and should generally not be depended on).

### Gaia **(WIP)**

*This feature is a work in progress.*

The Gaia extension is for hosts who also want compatibility with Blockstack's / Stacks' Gaia Hub specification.
A user would attach their Blockstack / Stacks account to their Tiny account and then would be able to use a
route to store their data on (such as `https://tiny.example.com/john.smith/gaia`). It basically uses the
**File** API underneath.

### WebFinger

The WebFinger extension is created for users and apps to add themselves to the root identifier,
for things like Activity Pubs.

### Activity Pub **(NYI)**

*This feature is not yet implemented.*

The ActivityPub extension is unfinished and delayed due to being able to be made using core features.

## Security

### General Warnings

There is no encryption here, and therefore no privacy
from the host. Applications must encrypt the db and file entries if they so desire.

In addition, there is no limit to the amount of keys stored, so beware
of users loading junk data.

### Security Rules for Custom Routes

- They must finish in under two seconds
- Timers are paused when the route is calling a promised function (such as `Tiny.db.get('my-key')`),
  but programs will be terminated for foul-play if they run more than one promised function at a time.
- While they are run in a Deno WebWorker, they have no permissions, and as such cannot access the disk
  nor make network requests.

## Configuration

Create a JSON file called `config.json`, with the following (typescript) schema:

```typescript
interface Config {
  ip: string; // api ip
  port: number; // api port

  sessionExpTime: number; // how much time (in ms) for the sessions to expire
  whitelist?: string[]; // a white list of usernames to allow
  serverName?: string; // the name of the server to be used in tokens -- defaults to "tiny"
}
```

## API

See [API.md](./API.md).

## TODO

See [TODO.md](./TODO.md).

## Known Issues & Concerns

- Spoofing a site breaks all security, due to the fact supporting no-backend apps make it hard to validate whether or not the
source is actually the source.
  - A solution to this would be implementing the "Secure" authorization feature, allowing an app to verify itself via a third
  party (per the node's request) and then being given a secure hash to use as its ID instead of the application's domain.
- There are no spam protections in place
- There are no file size / database limits in place
- There is no "encryption at rest" protection in place

## License

MIT

---

## Footnotes

[^1]: I don't know any other backends like this, so this is the only example I can give.

[^2]: For instance, a file explorer *could use root access* to give the user the ability to manage *everything*,
but in general this is not a good thing and apps should behave well by sticking to their given areas, using shared
collections if they need to share data with other apps.
