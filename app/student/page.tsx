import WorkspaceGate from "../workspace/workspace-gate";

export default function StudentPage() {
  return <WorkspaceGate requiredRole="student" />;
}
