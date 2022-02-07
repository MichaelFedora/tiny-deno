import { User, Session } from '../common/types.ts';
import { TinyRequest } from '../common/types.ts';

export interface AuthSession extends Session {
  readonly created: number;
}

export interface Handshake {
  id?: string;

  code?: string;
  user?: string;

  readonly app: string;
  readonly redirect: string;
  readonly scopes: string[];
  readonly created: number;
}

export interface MasterKey {
  id?: string;

  readonly user: string;
  readonly name: string;
  readonly created: number;
}

export interface AuthUser extends User {
  pass: string;
  salt: string;
  readonly created: number;
}

export interface AuthRequest extends TinyRequest {
  /** Available everywhere a session is authenticated */
  session?: AuthSession;

  /** Only accessible within the Handshake router */
  handshake?: Handshake;
  /** Only accessible within the MasterKey router */
  masterKey?: MasterKey;
}

export interface Config {
  readonly sessionExpTime: number;
  readonly handshakeExpTime: number;
  readonly whitelist?: string[];
}
