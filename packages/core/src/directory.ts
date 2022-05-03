import { Org, OrgID, OrgMember, OrgMemberStatus, Group } from "./org";
import { Server } from "./server";
import { getIdFromEmail } from "./util";
import { Auth } from "./auth";

export interface DirectoryUser {
    externalId?: string;
    email: string;
    name: string;
    active?: boolean;
}

export interface DirectoryGroup {
    externalId?: string;
    name: string;
    members: DirectoryUser[];
}

export interface DirectorySubscriber {
    userCreated(user: DirectoryUser, orgId: OrgID): Promise<OrgMember | void>;
    userUpdated(user: DirectoryUser, orgId: OrgID, userId: string): Promise<OrgMember | void>;
    userDeleted(user: DirectoryUser, orgId: OrgID, userId: string): Promise<void>;

    groupCreated(group: DirectoryGroup, orgId: OrgID): Promise<Group | void>;
    groupUpdated(group: DirectoryGroup, orgId: OrgID): Promise<void>;
    groupDeleted(group: DirectoryGroup, orgId: OrgID): Promise<void>;
}

export interface DirectoryProvider {
    subscribe(sub: DirectorySubscriber): void;
}

export class DirectorySync implements DirectorySubscriber {
    constructor(public readonly server: Server, providers: DirectoryProvider[] = []) {
        for (const provider of providers) {
            provider.subscribe(this);
        }
    }

    async userCreated(user: DirectoryUser, orgId: string) {
        const org = (orgId && (await this.server.storage.get(Org, orgId))) || null;
        if (org && org.directory.syncProvider === "scim" && org.directory.syncMembers) {
            const memberExists = org.members.some((member) => member.email === user.email);

            if (memberExists) {
                return;
            }

            const newOrgMember = new OrgMember({
                name: user.name,
                email: user.email,
                status: OrgMemberStatus.Provisioned,
                updated: new Date(),
            });

            org.members.push(newOrgMember);

            await this.server.updateMetaData(org);
            await this.server.storage.save(org);

            return newOrgMember;
        }
    }

    async userUpdated(user: DirectoryUser, orgId: string, userId: string) {
        const org = (orgId && (await this.server.storage.get(Org, orgId))) || null;
        if (org && org.directory.syncProvider === "scim" && org.directory.syncMembers) {
            const existingUser = org.members.find(
                (member) => member.accountId === userId || member.id === userId || member.email === userId
            );

            if (!existingUser) {
                return;
            }

            existingUser.name = user.name;
            existingUser.updated = new Date();

            await this.server.updateMetaData(org);
            await this.server.storage.save(org);

            return existingUser;
        }
    }

    async userDeleted(_user: DirectoryUser, orgId: string, userId: string) {
        const org = (orgId && (await this.server.storage.get(Org, orgId))) || null;
        if (org && org.directory.syncProvider === "scim" && org.directory.syncMembers) {
            const existingUser = org.members.find(
                (member) => member.accountId === userId || member.id === userId || member.email === userId
            );

            if (!existingUser) {
                return;
            }

            await org.removeMember(existingUser, false);

            // Remove any existing invites
            const existingInvite = org.invites.find((invite) => invite.email === existingUser.email);
            if (existingInvite) {
                org.removeInvite(existingInvite);

                try {
                    const auth = await this._getAuthForEmail(existingUser.email);
                    auth.invites = auth.invites.filter((invite) => invite.id !== existingInvite.id);
                    await this.server.storage.save(auth);
                } catch (_error) {
                    // Ignore
                }
            }

            await this.server.updateMetaData(org);
            await this.server.storage.save(org);
        }
    }

    async groupCreated(group: DirectoryGroup, orgId: string) {
        const org = (orgId && (await this.server.storage.get(Org, orgId))) || null;
        if (org && org.directory.syncProvider === "scim" && org.directory.syncGroups) {
            const groupExists = org.groups.some((group) => group.name === group.name);

            if (groupExists) {
                return;
            }

            const newGroup = new Group({
                name: group.name,
                // TODO: members
            });

            org.groups.push(newGroup);

            await this.server.updateMetaData(org);
            await this.server.storage.save(org);

            return newGroup;
        }
    }

    groupUpdated(_group: DirectoryGroup, _orgId: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
    groupDeleted(_group: DirectoryGroup, _orgId: string): Promise<void> {
        throw new Error("Method not implemented.");
    }

    private async _getAuthForEmail(email: string) {
        const auth = await this.server.storage.get(Auth, await getIdFromEmail(email));
        return auth;
    }
}
