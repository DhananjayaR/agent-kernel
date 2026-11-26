# ECS Fargate service for support-triage. [N] resources are declared by the generated deploy skill.
resource "aws_ecs_cluster" "this" {
  name = "support-triage"
}
