import { NonPostableEvt } from '../deps/evt.ts';
import { AuthUser, AuthSession, Handshake, MasterKey } from './auth-types.ts';

export abstract class AuthDb {

  protected sessionExpTime = 604800000;
  protected handshakeExpTime = 300000; // 5m

  public readonly onUserDelete: NonPostableEvt<AuthUser>;

  constructor(config: { sessionExpTime?: number; handshakeExpTime?: number },
    onUserDelete: NonPostableEvt<AuthUser>) {

    if(config.sessionExpTime)
      this.sessionExpTime = config.sessionExpTime;
    if(config.handshakeExpTime)
      this.handshakeExpTime = config.handshakeExpTime;

    this.onUserDelete = onUserDelete;

    this.onUserDelete.attach(async user => {
      try {
        const sessions = await this.getSessionIdsForUser(user.id!);
        await this.delManySessions(sessions);
      } catch(e) {
        console.error(`[AuthDb]: Error deleting sessions for deleted user "${user.username}" (${user.id})!`, e);
      }
    });
  }

  abstract addSession(user: string, scopes?: readonly string[]): Promise<string>;
  abstract getSession(session: string): Promise<AuthSession | null>;
  abstract delSession(session: string): Promise<void>;
  abstract delManySessions(sessions: readonly string[]): Promise<void>;
  /** Delete all expired sessions */
  abstract cleanSessions(): Promise<void>;
  abstract getSessionIdsForUser(user: string): Promise<string[]>;
  abstract getSessionsForUser(user: string): Promise<AuthSession[]>;

  // users

  abstract addUser(user: AuthUser): Promise<string>;
  abstract putUser(id: string, user: AuthUser): Promise<void>;
  abstract getUser(id: string): Promise<AuthUser | null>;
  abstract delUser(id: string): Promise<void>;
  abstract getUserFromUsername(username: string): Promise<AuthUser | null>;

  // user preferences

  /* abstract putUserPref(id: string, key: string, value: string);
  abstract getUserPref(id: string, key: string);
  abstract findUserPref(id: string, value: string);
  abstract findUserFromPref(key: string, value: string); */

  // handshakes

  abstract addHandshake(hs: Handshake): Promise<string>;
  abstract putHandshake(id: string, hs: Handshake): Promise<void>;
  abstract getHandshake(id: string): Promise<Handshake | null>;
  abstract delHandshake(id: string): Promise<void>;
  abstract getHandshakeFromCode(code: string): Promise<Handshake | null>;
  /** Delete all expires handshakes */
  abstract cleanHandshakes(): Promise<void>;

  // master keys

  abstract addMasterKey(key: MasterKey): Promise<string>;
  abstract putMasterKey(id: string, key: MasterKey): Promise<void>;
  abstract getMasterKey(id: string): Promise<MasterKey | null>;
  abstract delMasterKey(id: string): Promise<void>;
  abstract getMasterKeysForUser(user: string): Promise<MasterKey[]>;
}

export default AuthDb;
