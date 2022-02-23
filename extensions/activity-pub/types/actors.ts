import { Object } from './base-types.ts';

/**
 * Describes a software application.
 *
 * @see https://www.w3.org/ns/activitystreams#Application
 */
export interface Application extends Object {
  type: 'Application';
}

/**
 * Represents a formal or informal collective of Actors.
 *
 * @see https://www.w3.org/ns/activitystreams#Group
 */
export interface Group extends Object {
  type: 'Group';
}

/**
 * Represents an organization.
 *
 * @see https://www.w3.org/ns/activitystreams#Organization
 */
export interface Organization extends Object {
  type: 'Organization';
}

/**
 * Represents an individual person.
 *
 * @see https://www.w3.org/ns/activitystreams#Person
 */
export interface Person extends Object {
  type: 'Person';
}

/**
 * Represents a service of any kind.
 *
 * @see https://www.w3.org/ns/activitystreams#Service
 */
export interface Service extends Object {
  type: 'Service';
}
