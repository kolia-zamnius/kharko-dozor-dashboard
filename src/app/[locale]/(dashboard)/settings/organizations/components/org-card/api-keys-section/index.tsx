import { Spinner } from "@/components/ui/feedback/spinner";
import { Separator } from "@/components/ui/primitives/separator";
import type { Organization } from "@/api-client/organizations/schemas";
import { useOrgProjectsQuery } from "@/api-client/projects/queries";
import type { Project } from "@/api-client/projects/schemas";
import { useTranslations } from "next-intl";
import { CopyKeyButton } from "./copy-key-button";
import { CreateKeyDialog } from "./create-key-dialog";
import { DeleteKeyDialog } from "./delete-key-dialog";
import { RegenerateKeyDialog } from "./regenerate-key-dialog";

export function ApiKeysSection({ org }: { org: Organization }) {
  const t = useTranslations("settings.orgs.apiKeys");
  // Owner-only across every action in this section:
  //   - Create project (mints a new key)
  //   - Regenerate key
  //   - Copy plaintext key
  //   - Delete project
  //
  // Rationale: the API key is the credential that authenticates every
  // ingest call, so its entire lifecycle is concentrated under a single
  // role to keep governance simple and audit-friendly. Admins can still
  // rename projects and tweak display-name trait keys via their own
  // endpoints — the restriction here is specifically about credential
  // material. Admins and viewers see the masked-key preview but no
  // action affordances.
  const canManage = org.role === "OWNER";
  const { data: projects, isLoading } = useOrgProjectsQuery(org.id);

  return (
    <div className="space-y-3">
      <Separator />

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{t("heading")}</p>
        {canManage && <CreateKeyDialog organizationId={org.id} />}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Spinner className="size-4 border" />
        </div>
      ) : !projects?.length ? (
        <p className="text-muted-foreground py-2 text-sm">
          {t("empty")} {canManage && t("emptyHint")}
        </p>
      ) : (
        <div className="divide-border border-border divide-y rounded-lg border">
          {projects.map((project) => (
            <ApiKeyRow key={project.id} project={project} canManage={canManage} />
          ))}
        </div>
      )}
    </div>
  );
}

function ApiKeyRow({ project, canManage }: { project: Project; canManage: boolean }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{project.name}</p>
        <p className="text-muted-foreground truncate font-mono text-xs">{project.maskedKey}</p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {canManage && (
          <>
            <CopyKeyButton projectId={project.id} />
            <RegenerateKeyDialog project={project} />
            <DeleteKeyDialog project={project} />
          </>
        )}
      </div>
    </div>
  );
}
