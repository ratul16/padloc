import { Serializable, stringToBytes, AsBytes, AsSerializable, AsDate } from "./encoding";
import { PBKDF2Params } from "./crypto";
import { getCryptoProvider as getProvider } from "./platform";
import { DeviceInfo } from "./platform";
import { Storable } from "./storage";
import { AccountID } from "./account";
import { Authenticator, AuthRequest } from "./mfa";
import { KeyStoreEntryInfo } from "./key-store";
import { SessionInfo } from "./session";
import { SRPSession } from "./srp";
import { getIdFromEmail } from "./util";

export enum AccountStatus {
    Unverified = "unverified",
    Active = "active",
    Blocked = "blocked",
    Deleted = "deleted",
}

/**
 * Contains authentication data needed for SRP session negotiation
 */
export class Auth extends Serializable implements Storable {
    id: string = "";

    @AsDate()
    created: Date = new Date();

    /** Id of the [[Account]] the authentication data belongs to */
    account?: AccountID = undefined;

    status: AccountStatus = AccountStatus.Unverified;

    /** Verifier used for SRP session negotiation */
    @AsBytes()
    verifier?: Uint8Array;

    /**
     * Key derivation params used by the client to compute session key from the
     * users master password
     * */
    @AsSerializable(PBKDF2Params)
    keyParams = new PBKDF2Params();

    @AsSerializable(DeviceInfo)
    trustedDevices: DeviceInfo[] = [];

    @AsSerializable(Authenticator)
    authenticators: Authenticator[] = [];

    @AsSerializable(AuthRequest)
    authRequests: AuthRequest[] = [];

    @AsSerializable(KeyStoreEntryInfo)
    keyStoreEntries: KeyStoreEntryInfo[] = [];

    @AsSerializable(SessionInfo)
    sessions: SessionInfo[] = [];

    @AsSerializable(SRPSession)
    srpSessions: SRPSession[] = [];

    mfaOrder: string[] = [];

    /** Invites to organizations */
    invites: {
        id: string;
        orgId: string;
        orgName: string;
    }[] = [];

    constructor(public email: string = "") {
        super();
    }

    async init() {
        this.id = await getIdFromEmail(this.email);
    }

    /**
     * Generate the session key from the users master `password`
     */
    async getAuthKey(password: string) {
        // If no salt is set yet (i.e. during initialization),
        // generate a random value
        if (!this.keyParams.salt.length) {
            this.keyParams.salt = await getProvider().randomBytes(16);
        }
        return getProvider().deriveKey(stringToBytes(password), this.keyParams);
    }
}
