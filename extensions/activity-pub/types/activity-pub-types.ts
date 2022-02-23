import { Object } from './base-types.ts';

export interface ActivityObject extends Object {
  source: { content: string; mediaType: string };
}

export interface Actor extends Object {

  inbox: string;
  outbox: string;
  following: string;
  followers: string;
  liked: string;

  streams?: string[];

  preferredUsername?: string;
  preferredUsernameMap?: { [language: string]: string };

  endpoints?: Partial<{
    proxyUrl: string;
    oauthAuthorizationEndpoint: string;
    oauthTokenEndpoint: string;
    provideClientKey: string;
    signClientKey: string;
    sharedInbox: string;
  }>[];
}
