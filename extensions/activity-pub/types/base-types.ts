import { Image, Place } from './object-types.ts';

/**
 * Shared types between Objects and Links
 *
 * @type {ActivityStream}
 */
export interface ActivityStream {
  /**
   * Should always be included on the root type, but can be discarded on sub types.
   */
  '@context'?: 'https://www.w3.org/ns/activitystreams' | ['https://www.w3.org/ns/activitystreams'] & string[];

  /**
   * Provides the globally unique identifier for an [Object](https://www.w3.org/ns/activitystreams#Object){@link Object} or
   * [Link](https://www.w3.org/ns/activitystreams#Link){@link Link}.
   *
   * @type anyURI
   * @see https://www.w3.org/TR/activitystreams-vocabulary/#dfn-id
   */
  id: string;

  /**
   * Identifies the [Object](https://www.w3.org/ns/activitystreams#Object){@link Object} or
   * [Link](https://www.w3.org/ns/activitystreams#Link){@link Link} type. Multiple values may be specified.
   *
   * @type anyURI
   * @see https://www.w3.org/TR/activitystreams-vocabulary/#dfn-type
   */
  type: string | string[];

  /**
   * A simple, human-readable, plain-text name for the object. HTML markup **MUST NOT** be included.
   *
   * @type xsd:string | rdf:langString
   * @see https://www.w3.org/ns/activitystreams#name
   */
  name?: string;

  /**
   * Simple, human-readable, plain-text names for the object. HTML markup **MUST NOT** be included.
   * This is the name expressed using multiple language-tagged values.
   *
   * @type xsd:string | rdf:langString
   * @see https://www.w3.org/ns/activitystreams#nameMap
   */
  nameMap?: { [language: string]: string };

  /**
   * When used on a [Link]{@link Link}, identifies the MIME media type of the referenced resource.
   *
   * When used on an [Object]{@link Object}, identifies the MIME media type of the value of the content property.
   * If not specified, the content property is assumed to contain text/html content.
   *
   * @type MIME Media Type
   *
   * @see https://www.w3.org/ns/activitystreams#mediaType
   */
  mediaType?: string | 'text/html';

  /**
   * Identifies an entity that provides a preview of this object.
   *
   * @see https://www.w3.org/ns/activitystreams#preview
   */
  preview?: string | Object | Link;
}

/**
 * Describes an object of any kind. The Object type serves as the base type for most of the other kinds of objects defined in
 * the Activity Vocabulary, including other Core types such as Activity, IntransitiveActivity, Collection and OrderedCollection.
 *
 * @see https://www.w3.org/ns/activitystreams#Object
 */
export interface Object extends ActivityStream {
  /** @default 'Object' */
  type: 'Object' | string;

  /**
   * The date and time at which the object was published.
   *
   * @type xsd:dateTime
   * @see https://www.w3.org/ns/activitystreams#published
   */
  published?: string | Date;

  /**
   * The date and time at which the object was updated.
   *
   * @type xsd:dateTime
   * @see https://www.w3.org/ns/activitystreams#updated
   */
  updated?: string | Date;

  /**
   * Identifies one or more entities that represent the total population of entities for which the object can considered to be relevant.
   *
   * @example
   * https://www.w3.org/ns/activitystreams#Public
   *
   * @see https://www.w3.org/ns/activitystreams#audience
   */
  audience?: string | Link | Object | Array<string | Link | Object>;

  /**
   * The content or textual representation of the Object encoded as a JSON string. By default, the value of content is HTML.
   * The mediaType property can be used in the object to indicate a different content type.
   *
   * @example { mediaType: 'text/markdown', content: '## Header\n\nA very cool markdown `note`!' }
   *
   * @type xsd:string
   * @see https://www.w3.org/ns/activitystreams#content
   */
  content?: string;

  /**
   * The content or textual representation of the Object encoded as a JSON string expressed using multiple language-tagged values.
   * By default, the value of contents are HTML. The mediaType property can be used in the object to indicate a different content type.
   *
   *
   * @type rdf:langString
   * @see https://www.w3.org/ns/activitystreams#contentMap
   */
  contentMap?: { [language: string]: string };

  /**
   * A natural language summarization of the object encoded as HTML.
   * @see https://www.w3.org/ns/activitystreams#summary
   */
  summary?: string;

  /**
   * A natural multiple language summarization of the object encoded as HTML
   * @see https://www.w3.org/ns/activitystreams#summaryMap
   */
  summaryMap?: { [language: string]: string };

  /**
   * Identifies a resource attached or related to an object that potentially requires special handling.
   * The intent is to provide a model that is at least semantically similar to attachments in email.
   *
   * @see	https://www.w3.org/ns/activitystreams#attachment
   */
  attachment?: string | Link | Object | Array<string | Link | Object>;

  /**
   * Identifies the entity (e.g. an application) that generated the object.
   *
   * @see	https://www.w3.org/ns/activitystreams#generator
   */
  generator?: string | Link | Object | Array<string | Link | Object>;

  /**
   * Indicates an entity that describes an icon for this object.
   * The image should have an aspect ratio of one (horizontal) to one (vertical) and should be suitable
   * for presentation at a small size.
   *
   * @see https://www.w3.org/ns/activitystreams#icon
   */
  icon?: string | Link | Image | Array<string | Link | Image>;

  /**
   * Indicates an entity that describes an image for this object. Unlike the icon property,
   * there are no aspect ratio or display size limitations assumed.
   *
   * @see https://www.w3.org/ns/activitystreams#image
   */
  image?: string | Link | Image | Array<string | Link | Image>;

  /**
   * Indicates one or more physical or logical locations associated with the object.
   *
   * @see https://www.w3.org/ns/activitystreams#location
   */
  location?: string | Link | Place | Array<string | Link | Place>;

  /**
   * Identifies one or more links to representations of the object.
   *
   * @type xsd:anyURI | Link
   * @see https://www.w3.org/ns/activitystreams#url
   */
  url?: string | Link | Array<string | Link>;

  /**
   * One or more "tags" that have been associated with an objects. A tag can be any kind of Object.
   * The key difference between `attachment` and `tag` is that the former implies association by inclusion,
   * while the latter implies associated by reference.
   *
   * @see https://www.w3.org/ns/activitystreams#tag
   */
  tag?: string | Object | Link | Array<string | Object | Link>;

  /**
   * The date and time describing the actual or expected starting time of the object.
   * When used with an `Activity` object, for instance, the `startTime` property specifies the
   * moment the activity began or is scheduled to begin.
   *
   * @type xsd:dateTime
   * @see https://www.w3.org/ns/activitystreams#startTime
   */
  startTime?: string | Date;

  /**
   * The date and time describing the actual or expected ending  time of the object.
   * When used with an `Activity` object, for instance, the `endTime` property specifies the
   * moment the activity began or is scheduled to conclude.
   *
   * @type xsd:dateTime
   * @see https://www.w3.org/ns/activitystreams#endTime
   */
  endTime?: string | Date;

  /**
   * When the object describes a time-bound resource, such as an audio or video, a meeting, etc,
   * the duration property indicates the object's approximate duration. The value **MUST** be expressed as an
   * xsd:duration as defined by
   * [[xmlschema11-2](https://www.w3.org/TR/activitystreams-vocabulary/#bib-xmlschema11-2)],
   * section 3.3.6 (e.g. a period of 5 seconds is represented as "`PT5S`").
   *
   * @type xsd:duration
   * @see https://www.w3.org/ns/activitystreams#duration
   */
  duration?: string;

  /**
   * Identifies an entity considered to be part of the public primary audience of an Object
   *
   * @see https://www.w3.org/ns/activitystreams#to
   */
  to?: string | Object | Link | Array<string | Object | Link>;

  /**
   * Identifies an `Object` that is part of the private primary audience of this `Object`.
   *
   * @see https://www.w3.org/ns/activitystreams#bto
   */
  bto?: string | Object | Link | Array<string | Object | Link>;

  /**
   * Identifies an `Object` that is part of the public secondary audience of this `Object`.
   *
   * @see https://www.w3.org/ns/activitystreams#cc
   */
  cc?: string | Object | Link | Array<string | Object | Link>;

  /**
   * Identifies an `Object` that is part of the private secondary audience of this `Object`.
   *
   * @see https://www.w3.org/ns/activitystreams#bcc
   */
  bcc?: string | Object | Link | Array<string | Object | Link>;

  /**
   * Indicates one or more entities for which this object is considered a response.
   *
   * Generally would link or contain the posts (notes) which are being replied to.
   *
   * @see https://www.w3.org/ns/activitystreams#inReplyTo
   */
  inReplyTo?: string | Link | Object | Array<string | Link | Object>;

  /**
   * Identifies one or more entities to which this object is attributed. The attributed entities might not be `Actor`s.
   * For instance, an object might be attributed to the completion of another activity.
   *
   * @see https://www.w3.org/ns/activitystreams#attributedTo
   */
  attributedTo?: string | Link | Object | Array<string | Link | Object>;

  /**
   * Identifies the context within which the object exists or an activity was performed.
   *
   * The notion of "context" used is intentionally vague. The intended function is to serve
   * as a means of grouping objects and activities that share a common originating context or purpose.
   * An example could be all activities relating to a common project or event.
   *
   * @see https://www.w3.org/ns/activitystreams#context
   */
  context?: string | Link | Object | Array<string | Link | Object>;

  /**
   * Identifies a Collection containing objects considered to be responses to this object.
   *
   * @see https://www.w3.org/ns/activitystreams#replies
   */
  replies?: Collection;
}

/**
 * A Link is an indirect, qualified reference to a resource identified by a URL.
 * The fundamental model for links is established by [[RFC5988](https://www.w3.org/TR/activitystreams-vocabulary/#bib-RFC5988)].
 * Many of the properties defined by the Activity Vocabulary allow values that are either instances
 * of [Object](https://www.w3.org/ns/activitystreams#Object)
 * or [Link](https://www.w3.org/ns/activitystreams#Link){@link Link}.
 *
 * When a Link is used, it establishes a qualified relation connecting the subject (the containing object)
 * to the resource identified by the `href`.
 *
 * Properties of the Link are properties of the reference as opposed to properties of the resource.
 *
 * @see https://www.w3.org/ns/activitystreams#Link
 */
export interface Link extends ActivityStream {
  '@context': 'https://www.w3.org/ns/activitystreams';

  /** @default 'Link' */
  type: 'Link' | string;

  /**
   * The target resource pointed to by a Link.
   *
   * - Functional
   *
   * @type xsd:anyURI
   * @see https://www.w3.org/ns/activitystreams#href
   */
  href?: string;
  /**
   * Hints as to the language used by the target resource. Value MUST be a
   * [[BCP47](https://www.w3.org/TR/activitystreams-vocabulary/#bib-BCP47)] Language-Tag.
   *
   * - Functional
   *
   * @type BCP47 Language Tag (like `en`)
   * @see https://www.w3.org/ns/activitystreams#hreflang
   */
  hreflang?: 'en' | string;

  /**
   * A link relation associated with a Link. The value MUST conform to both the
   * [[HTML5](https://www.w3.org/TR/activitystreams-vocabulary/#bib-HTML5)] and
   * [[RFC5988](https://www.w3.org/TR/activitystreams-vocabulary/#bib-RFC5988)]
   * "link relation" definitions.
   *
   * In the [HTML5], any string not containing the "space" (`U+0020`), "tab" (`U+0009`),
   * "LF" (`U+000A`), "FF" (`U+000C`), "CR" (`U+000D`) or "," (`U+002C`)
   * characters can be used as a valid link relation.
   *
   * @type [RFC5988] or [HTML5] Link Relation
   * @see	https://www.w3.org/ns/activitystreams#rel
   */
  rel?: string;

  /**
   * On a Link, specifies a hint as to the rendering height in device-independent pixels of the linked resource.
   *
   * - Functional
   *
   * @type xsd:nonNegativeInteger
   * @see https://www.w3.org/ns/activitystreams#height
   */
  height?: number;

  /**
   * On a Link, specifies a hint as to the rendering width in device-independent pixels of the linked resource.
   *
   * - Functional
   *
   * @type xsd:nonNegativeInteger
   * @see https://www.w3.org/ns/activitystreams#width
   */
  width?: number;
}

/**
 * An Activity is a subtype of Object that describes some form of action that may happen, is
 * currently happening, or has already happened. The Activity type itself serves as an abstract base type for all
 * types of activities. It is important to note that the Activity type itself does not carry any specific
 * semantics about the kind of action being taken.
 *
 * @see https://www.w3.org/ns/activitystreams#Activity
 */
export interface Activity extends Object {
  /** @default 'Activity' */
  type: 'Activity' | string;

  /**
   * Describes one or more entities that either performed or are expected to perform the activity.
   * Any single activity can have multiple `actor`s. The `actor` **MAY** be specified using an indirect `Link`.
   *
   * Should generally only be used when an activity is a under the `attributedTo` property.
   *
   * @see https://www.w3.org/ns/activitystreams#actor
   */
  actor: string | Link | Object | Array<string | Link | Object>;

  /**
   * When used within an Activity, describes the direct object of the activity.
   * For instance, in the activity "John added a movie to his wishlist", the object of the
   * activity is the movie added.
   *
   * When used within a Relationship describes the entity to which the subject is related.
   *
   * @see https://www.w3.org/ns/activitystreams#object
   */
  object: string | Object | Link | Array<string | Object | Link>;

  /**
   * Describes the indirect object, or target, of the activity. The precise meaning of the target is
   * largely dependent on the type of action being described but will often be the object of the English
   * preposition "to". For instance, in the activity "John added a movie to his wishlist", the target of the
   * activity is John's wishlist. An activity can have more than one target.
   *
   * @see https://www.w3.org/ns/activitystreams#target
   */
  target?: string | Object | Link | Array<string | Object | Link>;

  /**
   * Describes the result of the activity. For instance, if a particular action results in the
   * creation of a new resource, the result property can be used to describe that new resource.
   *
   * @see https://www.w3.org/ns/activitystreams#result
   */
  result?: string | Object | Link | Array<string | Object | Link>;

  /**
   * Describes an indirect object of the activity from which the activity is directed. The precise
   * meaning of the origin is the object of the English preposition "from". For instance, in the activity
   * "John moved an item to List B from List A", the origin of the activity is "List A".
   *
   * @see https://www.w3.org/ns/activitystreams#origin
   */
  origin?: string | Object | Link;

  /**
   * Identifies one or more objects used (or to be used) in the completion of an Activity.
   *
   * @see https://www.w3.org/ns/activitystreams#instrument
   */
  instrument?: string | Object | Link | Array<string | Object | Link>;
}

/**
 * Instances of IntransitiveActivity are a subtype of Activity representing intransitive actions.
 * The object property is therefore inappropriate for these activities.
 *
 * @see https://www.w3.org/ns/activitystreams#IntransitiveActivity
 */
export interface IntransitiveActivity extends Activity {
  /** @default 'IntransitiveActivity' */
  type: 'IntransitiveActivity' | string;

  object: never;
}

/**
 * A `Collection` is a subtype of Object that represents ordered or unordered sets of Object or Link instances.
 *
 * Refer to the
 * [Activity Streams 2.0 Core](https://www.w3.org/TR/activitystreams-core/#collection)
 * specification for a complete description of the `Collection` type.
 *
 * @see https://www.w3.org/ns/activitystreams#Collection
 */
export interface Collection extends Object {
  /** @default 'Collection' */
  type: 'Collection' | string;

  /**
   * A non-negative integer specifying the total number of objects contained by the logical view of the collection.
   * This number might not reflect the actual number of items serialized within the `Collection` object instance.
   *
   * @type xsd:nonNegativeInteger
   * @see https://www.w3.org/ns/activitystreams#totalItems
   */
  totalItems: number;

  /**
   * In a paged `Collection`, indicates the page that contains the most recently updated member items.
   *
   * @see https://www.w3.org/ns/activitystreams#current
   */
  current?: string | Link | CollectionPage;

  /**
   * In a paged `Collection`, indicates the furthest preceding page of the collection.
   *
   * @see https://www.w3.org/ns/activitystreams#first
   */
   first?: string | Link | CollectionPage;

  /**
   * In a paged `Collection`, indicates the furthest proceeding page of the collection.
   *
   * @see https://www.w3.org/ns/activitystreams#last
   */
  last?: string | Link | CollectionPage;

  /**
   * Identifies the items contained in a collection. The items might be ordered or unordered.
   *
   * @see https://www.w3.org/ns/activitystreams#items
   */
  items?: string | Link | Object | Array<string | Link | Object>;

  /**
   * Identifies the items contained in a collection. The items should be ordered.
   *
   * @see https://www.w3.org/ns/activitystreams#orderedItems
   */
  orderedItems?: string | Link | Object | Array<string | Link | Object>;
}

/**
 * A subtype of `Collection` in which members of the logical collection are assumed to always be strictly ordered.
 *
 * @see https://www.w3.org/ns/activitystreams#OrderedCollection
 */
export interface OrderedCollection extends Collection {
  /** @default 'OrderedCollection' */
  type: 'OrderedCollection' | string;
}

/**
 * Used to represent distinct subsets of items from a `Collection`. Refer to the
 * [Activity Streams 2.0 Core](https://www.w3.org/TR/activitystreams-core/#dfn-collectionpage)
 * for a complete description of the `CollectionPage` object.
 *
 * @see	https://www.w3.org/ns/activitystreams#CollectionPage
 */
export interface CollectionPage extends Collection {
  /** @default 'CollectionPage' */
  type: 'CollectionPage' | string;

  /**
   * Identifies the `Collection` to which a `CollectionPage` objects items belong.
   *
   * @see https://www.w3.org/ns/activitystreams#partOf
   */
  partOf: string | Link | Collection;

  /**
   * In a paged `Collection`, identifies the next page of items.
   *
   * @type CollectionPage | Link
   * @see https://www.w3.org/ns/activitystreams#next
   */
  next?: string | Link | CollectionPage;

  /**
   * In a paged `Collection`, identifies the previous page of items.
   *
   * @type CollectionPage | Link
   * @see https://www.w3.org/ns/activitystreams#prev
   */
  prev?: string | Link | CollectionPage;
}

interface OrderedCollectionPagePartial extends CollectionPage {
  type: 'OrderedCollectionPage';

  /**
   * A non-negative integer value identifying the relative position within the logical view of a strictly ordered collection.
   *
   * @type xsd:nonNegativeInteger
   * @see https://www.w3.org/ns/activitystreams#startIndex
   */
  startIndex: number;
}

/**
 * Used to represent ordered subsets of items from an `OrderedCollection`. Refer to the
 * [Activity Streams 2.0 Core](https://www.w3.org/TR/activitystreams-core/#dfn-orderedcollectionpage)
 * for a complete description of the `OrderedCollectionPage` object.
 *
 * @see https://www.w3.org/ns/activitystreams#OrderedCollectionPage
 */
export type OrderedCollectionPage = OrderedCollectionPagePartial & OrderedCollection;
