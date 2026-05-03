export const routes = {
  trackedUsers: {
    list: () => "/api/tracked-users",
    summary: () => "/api/tracked-users/summary",
    detail: (userId: string) => `/api/tracked-users/${userId}`,
    activity: (userId: string) => `/api/tracked-users/${userId}/activity`,
    status: (userId: string) => `/api/tracked-users/${userId}/status`,
    timeline: (userId: string) => `/api/tracked-users/${userId}/timeline`,
    sessions: (userId: string) => `/api/tracked-users/${userId}/sessions`,
    displayName: (userId: string) => `/api/tracked-users/${userId}/display-name`,
  },

  projects: {
    list: (params?: { organizationId?: string }) => {
      const base = "/api/projects";
      if (!params?.organizationId) return base;
      return `${base}?organizationId=${encodeURIComponent(params.organizationId)}`;
    },
    detail: (projectId: string) => `/api/projects/${projectId}`,
    key: (projectId: string) => `/api/projects/${projectId}/key`,
    regenerateKey: (projectId: string) => `/api/projects/${projectId}/regenerate-key`,
    displayNameTraitKey: (projectId: string) => `/api/projects/${projectId}/display-name-trait-key`,
  },

  organizations: {
    list: () => "/api/organizations",
    detail: (orgId: string) => `/api/organizations/${orgId}`,
    active: () => "/api/organizations/active",
    members: (orgId: string) => `/api/organizations/${orgId}/members`,
    member: (orgId: string, memberId: string) => `/api/organizations/${orgId}/members/${memberId}`,
    invites: (orgId: string) => `/api/organizations/${orgId}/invites`,
    invite: (orgId: string, inviteId: string) => `/api/organizations/${orgId}/invites/${inviteId}`,
  },

  user: {
    me: () => "/api/user",
    avatar: () => "/api/user/avatar",
    locale: () => "/api/user/locale",
    passkey: (credentialId: string) => `/api/user/passkeys/${credentialId}`,
    account: (provider: string) => `/api/user/accounts/${provider}`,
    invites: () => "/api/user/invites",
    acceptInvite: (inviteId: string) => `/api/user/invites/${inviteId}/accept`,
    declineInvite: (inviteId: string) => `/api/user/invites/${inviteId}/decline`,
  },

  sessions: {
    list: () => "/api/sessions",
    summary: () => "/api/sessions/summary",
    detail: (sessionId: string) => `/api/sessions/${sessionId}`,
    sliceEvents: (sessionId: string, sliceIndex: number) => `/api/sessions/${sessionId}/slices/${sliceIndex}/events`,
  },
} as const;
