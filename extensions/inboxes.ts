/**
 * Implement an API to handle `POST /:context/:identifier/inbox/:inbox` requests
 *
 * This can be used for Activity Pub, Email, etc.
 *
 * - (private) GET /:context/:identifier/inboxes
 *   - gets the inboxes
 *
 * - (private) GET /:context/:identifier/inbox/:inbox
 *   - runs the inbox handler for an authorized GET
 * - (PUBLIC) POST /:context/:identifier/inbox/:inbox
 *   - runs the inbox handler for an unauthorized POST
 * - (private) PUT /:context/:identifier/inbox/:inbox
 *   - creates/updates the inbox handler function
 * - (private) DELETE /:context/:identifier/inbox/:inbox
 *   - deletes the inbox handler function
 *
 * Should use WebWorkers to run the inbox handlers with a WebWorker api
 * Should (eventually) limit the number of inboxes allowed (to 5 or so?)
 *
 * A filtered request is one that has SOME headers and the ability to parse
 * a JSON body, an ArrayBuffer body, or a Stream
 *
 * Handlers must have two `onmessage` handlers:
 * - 'get': Request ID, User, Filtered Request
 * - 'post': Request ID, Filtered Request
 *
 * Handlers must implement the `postMessage` response:
 * - 'respond', Request ID, Response
 *
 * An example activity pub implementation could be like so:
 * url: `https://tiny-node.domain/:app/:username`
 * id: `https://aspen.io/bob.test@localhost:3000`
 * inbox: `https://tiny-node.domain/aspen.io/bob.test/inbox/activity-pub`
 * outbox: `https://tiny-node.domain/aspen.io/bob.test/files/outbox.json`
 * liked: `https://tiny-node.domain/aspen.io/bob.test/files/liked.json`
 * following: `https://tiny-node.domain/aspen.io/bob.test/files/following.json`
 * followers: `https://tiny-node.domain/aspen.io/bob.test/files/followers.json`
 */

import { Router } from '../api/mod.ts';

import { TinyRequest } from '../common/types.ts';
import Api from '../common/api.ts';

export class InboxApi<Req extends TinyRequest = TinyRequest> extends Api<Req> {
  constructor() {
    super();
  }

  compile(router = new Router<Req>()): Router<Req> {

    // pal.run(handler);

    return router;
  }
}
