import { AuthClient, AuthType } from "@padloc/core/src/mfa";
import {
    startAuthentication,
    startRegistration,
    browserSupportsWebauthn,
    platformAuthenticatorIsAvailable,
} from "@simplewebauthn/browser";
import {
    PublicKeyCredentialCreationOptionsJSON,
    PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/typescript-types";

export class WebAuthnClient implements AuthClient {
    private _isWebAuthnSupported = false;
    private _isPlatformAuthenticatorAvailable = false;

    constructor() {
        (async () => {
            this._isWebAuthnSupported = await browserSupportsWebauthn();
            this._isPlatformAuthenticatorAvailable =
                this._isWebAuthnSupported && (await platformAuthenticatorIsAvailable());
        })();
    }

    supportsType(type: AuthType) {
        return (
            this._isWebAuthnSupported &&
            (type === AuthType.WebAuthnPortable ||
                (type === AuthType.WebAuthnPlatform && this._isPlatformAuthenticatorAvailable))
        );
    }

    async prepareRegistration(serverData: PublicKeyCredentialCreationOptionsJSON, _clientData: undefined) {
        return startRegistration(serverData);
    }

    async prepareAuthentication(serverData: PublicKeyCredentialRequestOptionsJSON, _clientData: undefined) {
        return startAuthentication(serverData);
    }
}

export function isWebAuthnSupported() {
    return browserSupportsWebauthn();
}

export const webAuthnClient = new WebAuthnClient();
