import { Link } from "react-router-dom";
import { PageHeader, Panel, PreviewDataNote } from "@/components/ikamva/primitives";
import { Button } from "@/components/ui/button";
import { employee, workspace } from "@/lib/ikamva/workspace-adapter";



function AccountPage() {
  return (
    <>
      <div className="flex flex-col gap-8">
        <PageHeader eyebrow="Account" title="Your workspace" description={workspace.companyName} />

        <Panel title="Employee configuration" description={`${employee.name} · ${employee.role}`}>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{employee.purpose}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/dashboard/onboarding">Re-run employee setup</Link>
            </Button>
          </div>
        </Panel>

        <PreviewDataNote what="account and billing" />
      </div>
    </>
  );
}

export default AccountPage;
