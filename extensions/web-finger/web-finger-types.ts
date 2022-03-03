/**
 * Standard WebFinger definition. `subject` is filled out by the Api.
 *
 * @example
 * ```typescript
 * {
 *   aliases: [
 *     'https://social.example/@bob.test',
 *     'https://social.example/users/bob.test'
 *   ],
 *
 *   links: [
 *     {
 *       rel: 'http://webfinger.net/rel/profile-page'
 *       type: 'text/html',
 *       href: 'https://social.exmaple/@bob.test'
 *     },
 *     {
 *       rel: 'self',
 *       type: 'application/activity+json',
 *       href: 'https://social.example/users/bob.test'
 *     }
 *   ]
 * }
 * ```
 */
export interface WebFinger {
   /** filed out by the API*/
   subject?: string;

  /**
   * The "aliases" array is an array of zero or more URI strings that
   * identify the same entity as the "subject" URI.
   *
   * @see https://datatracker.ietf.org/doc/html/rfc7033#section-4.4.2
   */
  aliases?: string[];

  /**
   *
   * The "properties" object comprises zero or more name/value pairs whose
   * names are URIs (referred to as "property identifiers") and whose
   * values are strings or null. Properties are used to convey additional
   * information about the subject of the JRD.
   *
   * @see https://datatracker.ietf.org/doc/html/rfc7033#section-4.4.3
   */
  properties?: Record<string, string | null>;

  /**
   * The "links" array has any number of member objects, each of which
   * represents a link.
   *
   * @see https://datatracker.ietf.org/doc/html/rfc7033#section-4.4.4
   */
  links?: {
    /**
     * The value of the "rel" member is a string that is either a URI or a
     * registered relation type. The value of the "rel" member MUST contain
     * exactly one URI or registered relation type. The URI or
     * registered relation type identifies the type of the link relation.
     *
     * The other members of the object have meaning only once the type of
     * link relation is understood. In some instances, the link relation
     * will have associated semantics enabling the client to query for other
     * resources on the Internet. In other instances, the link relation
     * will have associated semantics enabling the client to utilize the
     * other members of the link relation object without fetching additional
     * external resources.
     *
     * @summary The relation type of the link.
     *
     * @example 'http://webfinger.net/rel/profile-page'
     * @example 'self'
     *
     * @see https://datatracker.ietf.org/doc/html/rfc7033#section-4.4.4.1
     */
    rel: string;

    /**
     * The value of the "type" member is a string that indicates the media
     * type (MIME) of the target resource.
     *
     * @example 'text/html'
     * @example 'application/activity+json'
     *
     * @see https://datatracker.ietf.org/doc/html/rfc7033#section-4.4.4.2
     */
    type?: string;

    /**
     * The value of the "href" member is a string that contains a URI
     * pointing to the target resource.
     *
     * @see https://datatracker.ietf.org/doc/html/rfc7033#section-4.4.4.3
     */
    href?: string;

    /**
     * The "titles" object comprises zero or more name/value pairs whose
     * names are a language tag or the string "und". The string is
     * human-readable and describes the link relation. More than one title
     * for the link relation MAY be provided for the benefit of users who
     * utilize the link relation, and, if used, a language identifier SHOULD
     * be duly used as the name. If the language is unknown or unspecified,
     * then the name is "und".
     *
     * @see https://datatracker.ietf.org/doc/html/rfc7033#section-4.4.4.4
     */
    titles?: { [language: string]: string };

    /**
     * The "properties" object within the link relation object comprises
     * zero or more name/value pairs whose names are URIs (referred to as
     * "property identifiers") and whose values are strings or null.
     * Properties are used to convey additional information about the link
     * relation.
     *
     * @see https://datatracker.ietf.org/doc/html/rfc7033#section-4.4.4.5
     */
    properties?: Record<string, string | null>;
  }[];
}

/**
 * WebFinger info stored in the DB
 */
export interface WebFingerInfo {
  /** The context ('root' | 'secure' | {app.domain}) of the info entry */
  context: string;
  /** The identifier (user ID or secure hash) of the info entry */
  identifier: string;

  /** The user this info entry belongs to */
  user: string;

  /** Whether or not the given `href` should be used as an alias ID uri */
  alias?: boolean;
  /** The type of info */
  rel: string;
  /** The href for the info */
  href?: string;
}
