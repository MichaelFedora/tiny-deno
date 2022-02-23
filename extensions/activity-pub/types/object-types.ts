import { Object, Link } from './base-types.ts';

/**
 * Describes a relationship between two individuals. The `subject` and `object` properties are used
 * to identify the connected individuals.
 *
 * See [5.2 Representing Relationships Between Entities](https://www.w3.org/TR/activitystreams-vocabulary/#connections)
 * for additional information.
 *
 * @see https://www.w3.org/ns/activitystreams#Relationship
 */
 export interface Relationship extends Object {
  type: 'Relationship' | string;

  /**
   * On a Relationship object, the subject property identifies one of the connected individuals.
   * For instance, for a Relationship object describing "John is related to Sally", `subject` would refer to John.
   *
   * @see https://www.w3.org/ns/activitystreams#subject
   */
  subject: string | Object | Link;

  /**
   * When used within an Activity, describes the direct object of the activity.
   * For instance, in the activity "John added a movie to his wishlist", the object of the
   * activity is the movie added.
   *
   * When used within a Relationship describes the entity to which the `subject` is related.
   *
   * @see https://www.w3.org/ns/activitystreams#object
   */
   object: string | Object | Link;

   /**
    * On a Relationship object, the relationship property identifies the kind of relationship that exists between `subject` and `object`.
    *
    * Should generally be a link to `http://purl.org/vocab/relatinship/` with a identifier of `influencedBy` (follower), `friendOf` (friend), or `acquaintanceOf` (follower).
    *
    * @example { relationship: "http://purl.org/vocab/relationship/acquaintanceOf" }
    *
    * @see https://www.w3.org/ns/activitystreams#relationship
    * @see https://vocab.org/relationship/
    */
   relationship: string;
}

/**
 * Represents any kind of multi-paragraph written work.
 *
 * @see https://www.w3.org/ns/activitystreams#Article
 */
export interface Article extends Object {
  type: 'Article';
}

/**
 * Represents a document of any kind.
 *
 * `name` is recommended.
 *
 * @see https://www.w3.org/ns/activitystreams#Document
 */
export interface Document extends Object {
  /** @default 'Document' */
  type: 'Document' | string;

  url: string | Link | Array<string | Link>;
}

/**
 * Represents an audio document of any kind.
 *
 * `name` is recommended.
 *
 * @see https://www.w3.org/ns/activitystreams#Audio
 */
export interface Audio extends Document {
  type: 'Audio';

  url: Link | Array<Link>;
}

/**
 * An image document of any kind.
 *
 * `name` is recommended.
 *
 * @see https://www.w3.org/ns/activitystreams#Image
 */
export interface Image extends Document {
  type: 'Image';

  url: Link | Array<Link>;
}

/**
 * An video document of any kind.
 *
 * `name` is recommended.
 *
 * @see https://www.w3.org/ns/activitystreams#Video
 */
 export interface Video extends Document {
  type: 'Video';

  url: Link | Array<Link>;
}

/**
 * Represents a short written work typically less than a single paragraph in length.
 *
 * `name` is recommended.
 *
 * Generally used as a micro-blog post.
 *
 * @see https://www.w3.org/ns/activitystreams#Note
 */
export interface Note extends Object {
  type: 'Note';

  content: string;
}

/**
 * Represents a Web Page.
 *
 * `name` is recommended.
 *
 * @see https://www.w3.org/ns/activitystreams#Page
 */
export interface Page extends Document {
  type: 'Page';

  url: string | string[];
}

/**
 * Represents any kind of event.
 *
 * @see https://www.w3.org/ns/activitystreams#Event
 */
export interface Event extends Object {
  type: 'Event';

  name: string;

  startTime: Date;
  endTime: Date;
}

/**
 * Represents a logical or physical location. See
 * [5.3 Representing Places](https://www.w3.org/TR/activitystreams-vocabulary/#places)
 * for additional information.
 *
 * `name` is recommended.
 *
 * @see https://www.w3.org/ns/activitystreams#Place
 */
export interface Place extends Object {
  type: 'Place';

  /**
   * The latitude of a place.
   *
   * @type xsd:float
   * @see https://www.w3.org/ns/activitystreams#latitude
   */
  latitude: number;

  /**
   * The longitude of a place.
   *
   * @type xsd:float
   * @see https://www.w3.org/ns/activitystreams#longitude
   */
  longitude: number;

  /**
   * Indicates the altitude of a place. The measurement units is indicated using the `units` property.
   * If `units` is not specified, the default is assumed to be "`m`" indicating meters.
   *
   * @type xsd:float
   * @see https://www.w3.org/ns/activitystreams#altitude
   */
  altitude?: number;

  /**
   * The radius from the given latitude and longitude for a `Place`.
   * The units is expressed by the `units` property. If `units` is not specified,
   * the default is assumed to be "m" indicating "meters".
   *
   * @type xsd:float [>= 0.0f]
   * @see https://www.w3.org/ns/activitystreams#radius
   */
  radius?: number;

  /**
   * Specifies the measurement units for the `radius` and `altitude` properties on a `Place` object.
   * If not specified, the default is assumed to be "m" for "meters".
   *
   * @example 'miles' | 'feet' | 'inches' | 'km' | 'm' | 'cm' | xsd:anyURI
   * @default 'm'
   * @see https://www.w3.org/ns/activitystreams#units
   */
  units?: 'miles' | 'feet' | 'inches' | 'km' | 'm' | 'cm' | string;

  /**
   * Indicates the accuracy of position coordinates on a `Place` objects. Expressed in properties of percentage. e.g. "94.0" means "94.0% accurate".
   *
   * @type xsd:float [>= 0.0f, <= 100.0f]
   * @see https://www.w3.org/ns/activitystreams#accuracy
   */
  accuracy?: number;
}

/**
 * A Profile is a content object that describes another Object, typically used to describe Actor Type objects.
 * The `describes` property is used to reference the object being described by the profile.
 *
 * @see https://www.w3.org/ns/activitystreams#Profile
 */
export interface Profile extends Object {
  type: 'Profile';

  /**
   * On a Profile object, the describes property identifies the object described by the Profile.
   *
   * @see https://www.w3.org/ns/activitystreams#describes
   */
  describes: string | Object | Array<string | Object>;
}

/**
 * A Tombstone represents a content object that has been deleted. It can be used in Collections to
 * signify that there used to be an object at this position, but it has been deleted.
 *
 * @see https://www.w3.org/ns/activitystreams#Tombstone
 */
export interface Tombstone extends Object {
  type: 'Tombstone';

  /**
   * On a Tombstone object, the formerType property identifies the type of the object that was deleted.
   *
   * @see https://www.w3.org/ns/activitystreams#formerType
   */
  formerType: string | string[];

  /**
   * On a Tombstone object, the deleted property is a timestamp for when the object was deleted.
   *
   * @see https://www.w3.org/ns/activitystreams#deleted
   */
  deleted: Date;
}
