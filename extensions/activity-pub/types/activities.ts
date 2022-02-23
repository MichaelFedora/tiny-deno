import { Link, Object, Activity, IntransitiveActivity } from './base-types.ts';
import { Place } from './object-types.ts';

/**
 * Indicates that the `actor` accepts the `object`. The `target` property can be used in certain circumstances to indicate the
 * context into which the `object` has been accepted.
 *
 * @see https://www.w3.org/ns/activitystreams#Accept
 */
export interface Accept extends Activity {
  /** @default 'Accept' */
  type: 'Accept' | string;
}

/**
 * Indicates that the `actor` is rejecting the `object`. The target and origin typically have no defined meaning.
 *
 * @see https://www.w3.org/ns/activitystreams#Reject
 */
export interface Reject extends Activity {
  /** @default 'Reject' */
  type: 'Reject' | string;
}

/**
 * @see https://www.w3.org/ns/activitystreams#TentativeReject
 */
export interface TentativeReject extends Reject {
  type: 'TentativeReject';
}

/**
 * A specialization of Accept indicating that the acceptance is tentative.
 *
 * @see https://www.w3.org/ns/activitystreams#TentativeAccept
 */
export interface TentativeAccept extends Accept {
  type: 'TentativeAccept';
}

/**
 * Indicates that the `actor` is calling the `target`'s attention the `object`.
 *
 * The `origin` typically has no defined meaning.
 *
 * @see https://www.w3.org/ns/activitystreams#Announce
 */
export interface Announce extends Activity {
  type: 'Announce';
}

/**
 * An IntransitiveActivity that indicates that the `actor` has arrived at the `location`.
 * The `origin` can be used to identify the context from which the `actor` originated.
 * The `target` typically has no defined meaning.
 *
 * @see https://www.w3.org/ns/activitystreams#Arrive
 */
export interface Arrive extends IntransitiveActivity {
  type: 'Arrive';

  actor: string | Link | Object | Array<string | Link | Object>;
  location: string | Link | Place | Array<string | Link | Place>;
}

/**
 * Indicates that the `actor` is traveling to `target` from `origin`.
 * `Travel` is an `IntransitiveActivity` whose actor specifies the direct object.
 *
 * If the `target` or `origin` are not specified, either can be determined by context.
 *
 * @see https://www.w3.org/ns/activitystreams#Travel
 */
export interface Travel extends IntransitiveActivity {
  type: 'Travel';
}

/**
 * Indicates that the `actor` has added the `object` to the `target`.
 * If the `target` property is not explicitly specified, the target would need to be determined implicitly by context.
 * The `origin` can be used to identify the context from which the `object` originated.
 *
 * @see https://www.w3.org/ns/activitystreams#Add
 */
export interface Add extends Activity {
  type: 'Add';
}

/**
 * Indicates that the actor has created the object.
 *
 * @see https://www.w3.org/ns/activitystreams#Create
 */
export interface Create extends Activity {
  type: 'Create';
}


/**
 * Indicates that the `actor` has updated the `object`. Note, however, that this vocabulary does not define a
 * mechanism for describing the actual set of modifications made to `object`.
 *
 * The target and origin typically have no defined meaning.
 *
 * @see https://www.w3.org/ns/activitystreams#Update
 */
export interface Update extends Activity {
  type: 'Update';
}

/**
 * Indicates that the actor has read the object.
 *
 * @see https://www.w3.org/ns/activitystreams#Read
 */
export interface Read extends Activity {
  type: 'Read';
}

/**
 * Indicates that the `actor` has viewed the `object`.
 *
 * @see https://www.w3.org/ns/activitystreams#View
 */
export interface View extends Activity {
  type: 'View';
}

/**
 * Indicates that the `actor` has moved `object` from `origin` to `target`.
 * If the `origin` or `target` are not specified, either can be determined by context.
 *
 * @see https://www.w3.org/ns/activitystreams#Move
 */
export interface Move extends Activity {
  type: 'Move';
}

/**
 * Indicates that the `actor` has deleted the `object`. If specified, the `origin` indicates the context from which the `object` was deleted.
 *
 * @see https://www.w3.org/ns/activitystreams#Delete
 */
export interface Delete extends Activity {
  type: 'Delete';
}

/**
 * Indicates that the `actor` is removing the `object`. If specified, the `origin` indicates the context from which the `object` is being removed.
 *
 * @see https://www.w3.org/ns/activitystreams#Remove
 */
export interface Remove extends Activity {
  type: 'Remove';
}


/**
 * Indicates that the `actor` likes, recommends or endorses the `object`. The `target` and `origin` typically have no defined meaning.
 *
 * @see https://www.w3.org/ns/activitystreams#Like
 */
export interface Like extends Activity {
  type: 'Like';
}

/**
 * Indicates that the `actor` dislikes the `object`.
 *
 * @see https://www.w3.org/ns/activitystreams#Dislike
 */
export interface Dislike extends Activity {
  type: 'Dislike';
}

/**
 * Indicates that the `actor` is "flagging" the `object`. Flagging is defined in the sense common to many social platforms
 * as reporting content as being inappropriate for any number of reasons.
 *
 * @see https://www.w3.org/ns/activitystreams#Flag
 */
export interface Flag extends Activity {
  type: 'Flag';
}

/**
 * Indicates that the `actor` is "following" the `object`. Following is defined in the sense typically used within
 * Social systems in which the `actor` is interested in any activity performed by or on the `object`.
 * The `target` and `origin` typically have no defined meaning.
 *
 * @see https://www.w3.org/ns/activitystreams#Follow
 */
export interface Follow extends Activity {
  type: 'Follow';
}

/**
 * Indicates that the `actor` is ignoring the `object`. The target and origin typically have no defined meaning.
 *
 * @see https://www.w3.org/ns/activitystreams#Ignore
 */
export interface Ignore extends Activity {
  /** @default 'Ignore' */
  type: 'Ignore' | string;
}

/**
 * Indicates that the `actor` is blocking the `object`. Blocking is a stronger form of `Ignore`.
 * The typical use is to support social systems that allow one user to block activities or content of other users.
 *
 * The `target` and `origin` typically have no defined meaning.
 *
 * @see https://www.w3.org/ns/activitystreams#Block
 */
export interface Block extends Ignore {
  type: 'Block';
}

/**
 * Indicates that the `actor` has joined the `object`. The `target` and `origin` typically have no defined meaning.
 *
 * @see https://www.w3.org/ns/activitystreams#Join
 */
export interface Join extends Activity {
  type: 'Join';
}

/**
 * Indicates that the `actor` has left the `object`. The `target` and `origin` typically have no meaning.
 *
 * @see https://www.w3.org/ns/activitystreams#Leave
 */
export interface Leave extends Activity {
  type: 'Leave';
}

/**
 * Indicates that the `actor` has listened to the `object`.
 * @see https://www.w3.org/ns/activitystreams#Listen
 */
export interface Listen extends Activity {
  type: 'Listen';
}

/**
 * Indicates that the `actor` is offering the `object`. If specified, the `target` indicates the entity to which the `object` is being offered.
 *
 * @see https://www.w3.org/ns/activitystreams#Offer
 */
export interface Offer extends Activity {
  type: 'Offer';
}

/**
 * A specialization of `Offer` in which the `actor` is extending an invitation for the `object` to the `target`.
 *
 * @see https://www.w3.org/ns/activitystreams#Invite
 */
export interface Invite extends Activity {
  type: 'Invite';
  target: string | Link | Object | Array<string | Link | Object>;
}

/**
 * Represents a question being asked. `Question` objects are an extension of `IntransitiveActivity`.
 * That is, the `Question` object is an Activity, but the direct object is the question itself and therefore it would not contain an `object` property.
 *
 * Either of the `anyOf` and `oneOf` properties **MAY** be used to express possible answers, but a Question object **MUST NOT** have both properties.
 *
 * @see https://www.w3.org/ns/activitystreams#Question
 */
export interface Question extends IntransitiveActivity {
  type: 'Question';

  /**
   * Identifies an exclusive option for a Question. Use of `oneOf` implies that the
   * `Question` can have only a single answer. To indicate that a Question can have multiple
   * answers, use `anyOf`.
   *
   * @see https://www.w3.org/ns/activitystreams#oneOf
   */
  oneOf?: string | Link | Object | Array<string | Link | Object>;

  /**
   * Identifies an inclusive  option for a Question. Use of `anyOf` implies that the
   * `Question` can have only a multiple answers. To indicate that a Question can only have one
   * answer, use `oneOf`.
   *
   * @see https://www.w3.org/ns/activitystreams#anyOf
   */
  anyOf?: string | Link | Object | Array<string | Link | Object>;

  /**
   * Indicates that a question has been closed, and answers are no longer accepted.
   *
   * @type Object | Link | xsd:dateTime | xsd:boolean
   * @see https://www.w3.org/ns/activitystreams#close
   */
  closed?: boolean | string | Date | Link | Object;
}

/**
 * Indicates that the `actor` is undoing the `object`. In most cases, the `object` will be an `Activity` describing some previously performed action
 * (for instance, a person may have previously "liked" an article but, for whatever reason, might choose to undo that like at some later point in time).
 *
 * The `target` and `origin` typically have no defined meaning.
 *
 * @see https://www.w3.org/ns/activitystreams#Undo
 */
export interface Undo extends Activity {
  type: 'Undo';
}



