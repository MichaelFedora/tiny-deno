import { User } from '../../common/types.ts';

/**
 * @todo
 * implement an activity pub api for user-to-user (or user-to-system) interaction
 *
 * The real TODO is to create the routes *for a third-party app* to use, and generate
 * a *scoped* activity pub API
 *
 * Such as POST /outbox { type: Create, object: { type: 'Note', content: 'hey!' } },
 * it would insert the user AND app as the actor...
 *
 * scoped activity-pub: `https://tiny-node.domain/pub/app/:app/u/:username`
 * global activity-pub(?): `https://tiny-node.domain/pub/u/:username`
 *
 * server name: `https://tiny-node.domain/`
 * router namespace: `/activity-pub`
 * route params: `/:app/u/:username`
 *
 * full url: `https://tiny-node.domain/activity-pub/:app/u/:username`
 * id: `${url}`
 * inbox: `${url}/inbox`
 * outbox: `${url}/outbox`
 * liked: `${url}/liked`
 * following: `${url}/following`
 * followers: `${url}/followers`
 *
 * webfinger: `https://tiny-node.domain/.well-known/webfinger'
 * - request with `acct:{username}~{app}@tiny-node.domain` for a scoped activity pub in/outbox/etc
 * - request with `acct:{username}@tiny-node.domain` for the big activity pub in/outbox/etc
 *
 *
 * ---
 *
 * with alternative implementation
 *
 * url: `https://tiny-node.domain/:app/:username`
 * id: `https://aspen.io/bob.test@localhost:3000`
 * inbox: `https://tiny-node.domain/aspen.io/bob.test/inbox/activity-pub`
 * outbox: `https://tiny-node.domain/aspen.io/bob.test/files/outbox.json`
 * liked: `https://tiny-node.domain/aspen.io/bob.test/files/liked.json`
 * following: `https://tiny-node.domain/aspen.io/bob.test/files/following.json`
 * followers: `https://tiny-node.domain/aspen.io/bob.test/files/followers.json`
 */

interface MyPerson extends Person, Security {
  '@context': [
    'https://www.w3.org/ns/activitystreams',
    'https://w3id.org/security/v1'
  ];

  type: 'Person';
  preferredUsername: string;
  inbox: string;

  publicKey: {
    id: string;
    owner: string;
    publicKeyPem: string;
  }
}

const publicStream = 'https://www.w3.org/ns/activitystreams#Public';

function makePostCreate(publicUrl: string, user: User, post: { id: string; url: string; created: Date; content: string; to: string[]; reply?: string }): Create {
  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    type: 'Create',

    id: publicUrl + 'post',
    actor: publicUrl + user.username,

    object: {
      id: publicUrl + post.id,
      type: 'Note',
      published: post.created,
      attributedTo: publicUrl + user.username,
      inReplyTo: post.reply,
      content: post.content,
      to: post.to.length === 1 ? post.to[0] : post.to
    }
  };
}

async function makeHttpSignature(doc: Create, destinationUrl: string, key: CryptoKey, date = new Date()) {
  const a = crypto.subtle.generateKey({
    name: 'RSA-OAEP',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256'
  }, true, ['wrapKey', 'unwrapKey', 'encrypt', 'decrypt']);

  const stringToSign = `
    (request-target): post /inbox
    host: ${destinationUrl}
    date: ${date}`.slice(1).replace(/^\s{4}/gm, '');

  const signed = await crypto.subtle.sign('sha256', key, new TextEncoder().encode(stringToSign));

  return `keyId="${doc.actor}",headers="(request-target) host date",signature="${new TextDecoder().decode(signed)}"`;
}

Deno.test(async function testMakeHttpSignature() {
  console.log(await makeHttpSignature())
})
/**
 * The "who"
 * @param publicUrl
 * @param user
 * @returns
 */
async function makeUserActor(publicUrl: string, user: User, publicKey: CryptoKey): Promise<Person> {
  return {
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1'
    ],

    id: publicUrl + 'actor',
    type: 'Person',
    preferredUsername: user.username,
    inbox: publicUrl + 'inbox',

    publicKey: {
      id: publicUrl + 'actor#main-key',
      owner: publicUrl + user.username,
      publicKeyPem: new TextDecoder().decode(await crypto.subtle.exportKey('pkcs8', publicKey))
    }
  };
}
