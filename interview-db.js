/**
 * Life Ledger — DevOps, SRE, MLOps, and Cloud Interview Q&A Database & Generator
 */
(function () {
  const CURATED_QUESTIONS = [
    // --- KUBERNETES & CONTAINERS ---
    {
      id: "k8s-1",
      category: "Kubernetes",
      difficulty: "Hard",
      question: "A Pod is stuck in 'CrashLoopBackOff'. Walk me through your troubleshooting workflow using CLI tools to pinpoint the root cause.",
      answer: "1. **Check Pod Status and Events**:\n   `kubectl describe pod <pod-name>`\n   Look at the 'Events' section at the bottom for image pull errors, volume mounting issues, liveness probe failures, or OOMKilled codes.\n2. **Examine Container Exit Codes**:\n   Under 'Last State', check the 'Exit Code' and 'Reason'. Exit Code `137` usually indicates an OOM (Out Of Memory) event. Exit Code `1` or other non-zero numbers represent application runtime crashes.\n3. **Inspect Application Logs (Current & Previous)**:\n   If the container crashed immediately, get logs from the *previous* crashed instance:\n   `kubectl logs <pod-name> --previous`\n4. **Verify Liveness/Readiness Probes**:\n   Confirm if the probe paths are correct, timeouts are reasonable, and services are listening on the designated ports.\n5. **Check Resource Limits & CPU/Memory Usage**:\n   If exit code is `137`, increase the memory limits in the deployment manifest. Run `kubectl top pod` to see real-time consumption.",
      tags: ["CrashLoopBackOff", "Debugging", "kubectl", "CLI"]
    },
    {
      id: "k8s-2",
      category: "Kubernetes",
      difficulty: "Intermediate",
      question: "What is the difference between a Kubernetes 'Service' of type 'ClusterIP', 'NodePort', and 'LoadBalancer'?",
      answer: "- **ClusterIP**: Exposes the Service on a cluster-internal IP. Reaching this Service is only possible from within the cluster. This is the default ServiceType.\n- **NodePort**: Exposes the Service on each Node's IP at a static port (in the 30000-32767 range). A ClusterIP Service, to which the NodePort Service routes, is automatically created. You can contact the NodePort Service from outside the cluster by requesting `<NodeIP>:<NodePort>`.\n- **LoadBalancer**: Exposes the Service externally using a cloud provider's load balancer (e.g., AWS NLB/ALB or GCP HTTP Load Balancer). Traffic from the external load balancer is routed to the backend NodePort and ClusterIP services automatically.",
      tags: ["Networking", "Service", "LoadBalancer"]
    },
    {
      id: "k8s-3",
      category: "Kubernetes",
      difficulty: "Hard",
      question: "How does the Kubernetes Horizontal Pod Autoscaler (HPA) compute the target replica count? Explain the formula.",
      answer: "The HPA controller queries the Resource Metrics API (or Custom Metrics API) for metrics specified in its configuration. It computes the target replica count using the following formula:\n\n`TargetNumReplicas = ceil( CurrentNumReplicas * ( CurrentMetricValue / TargetMetricValue ) )`\n\nFor example, if current replicas is `2`, current metric (e.g. average CPU utilization) is `80%`, and target metric is `50%`, the calculation is:\n`ceil(2 * (80 / 50)) = ceil(3.2) = 4 replicas`.\nIf the ratio is close to 1 (within a tolerance of 10%), the controller skips scaling to prevent rapid fluctuations ('flapping').",
      tags: ["Scaling", "HPA", "Metrics"]
    },
    {
      id: "docker-1",
      category: "Docker",
      difficulty: "Intermediate",
      question: "What are Docker multi-stage builds and why should you use them?",
      answer: "Multi-stage builds allow you to use multiple `FROM` instructions in a single `Dockerfile`. Each `FROM` instruction starts a new stage of the build using a different base image.\n\n**Why use them**:\n1. **Minimizes Image Size**: You can compile your application in a heavy build stage (containing compiler tools, SDKs, test suites) and copy only the compiled binary or build assets into a final, lightweight runtime stage (like `alpine` or `distroless`).\n2. **Security**: Final images do not contain development dependencies, package managers, or SDKs, which reduces the attack surface.\n3. **Clarity**: You don't need to maintain separate build and run Dockerfiles, reducing pipeline complexity.",
      tags: ["Dockerfile", "Multi-stage", "Optimization"]
    },

    // --- AWS & GCP ---
    {
      id: "aws-1",
      category: "AWS",
      difficulty: "Hard",
      question: "Explain the difference between a VPC Peering connection and AWS Transit Gateway. When would you choose one over the other?",
      answer: "- **VPC Peering**: A direct network routing connection between two VPCs. Routing is non-transitive (VPC A cannot talk to VPC C through B). Peering scales quadratically: linking $N$ VPCs requires $N(N-1)/2$ peering connections, which becomes complex to manage at scale.\n- **AWS Transit Gateway**: Acts as a cloud router, connecting VPCs and on-premises networks via a central hub. It supports transitive routing (VPC A can route to VPC C through Transit Gateway).\n\n**When to choose**:\n- Choose **VPC Peering** for a small number of VPCs (e.g., < 5) or for maximum throughput and minimum latency (data transfer costs are cheaper since traffic stays local).\n- Choose **Transit Gateway** for hub-and-spoke enterprise architectures with tens or hundreds of VPCs, multi-account structures, or hybrid VPN connections, to simplify route table management.",
      tags: ["VPC", "Transit Gateway", "Networking"]
    },
    {
      id: "gcp-1",
      category: "GCP",
      difficulty: "Intermediate",
      question: "How do GCP IAM Workload Identity Federations improve security for GKE workloads talking to GCP APIs?",
      answer: "Traditionally, pods in GKE had to authenticate to GCP services by downloading service account JSON keys and mounting them into the pod. This presented serious security risks (key leaks, rotation overhead).\n\n**Workload Identity** solves this by linking a Kubernetes Service Account (KSA) directly to a Google Cloud Service Account (GSA):\n1. When a Pod runs as the KSA, it requests a token from GKE's local metadata server.\n2. GKE exchanges this Kubernetes token for a temporary GCP OAuth token.\n3. The pod uses the GSA permissions via this temporary token, which automatically expires in 1 hour.\nThis removes the need to store, mount, or rotate static, long-lived JSON keys.",
      tags: ["IAM", "GKE", "Security", "Workload Identity"]
    },
    {
      id: "cloud-1",
      category: "AWS",
      difficulty: "Intermediate",
      question: "Explain the concept of envelope encryption. How does AWS KMS implement it?",
      answer: "Envelope encryption is the practice of encrypting plaintext data with a unique **data key**, and then encrypting the data key itself with a root **Key Encryption Key (KEK)** managed in a secure KMS HSM.\n\n**AWS KMS Implementation**:\n1. The client calls `GenerateDataKey` on KMS, providing the Customer Managed Key (CMK) ID.\n2. KMS returns two things: the **plaintext data key** and the **encrypted data key** (encrypted by the CMK).\n3. The client uses the plaintext data key to encrypt the large dataset locally and then discards the plaintext key from memory.\n4. The client stores the encrypted dataset along with the encrypted data key.\n5. To decrypt, the client sends the encrypted data key to KMS, which decrypts it using the CMK and returns the plaintext data key to decrypt the dataset.",
      tags: ["KMS", "Encryption", "Security"]
    },

    // --- TERRAFORM & IaC ---
    {
      id: "tf-1",
      category: "Terraform",
      difficulty: "Intermediate",
      question: "What is Terraform State locking? Why is it crucial and what backends support it?",
      answer: "Terraform state locking is a mechanism that prevents concurrent executions of Terraform against the same state file. If two engineers or CI/CD pipelines run `terraform apply` simultaneously, state locking prevents race conditions, write collisions, and state file corruption.\n\n**How it works**:\n- When a command starts, Terraform acquires a lock on the state.\n- Any other execution attempt is blocked and receives a 'ResourceLocked' error.\n- Once the execution completes, the lock is released.\n\n**Supporting Backends**: AWS S3 (using a DynamoDB table for locks), HashiCorp Consul, Azure Blob Storage, Google Cloud Storage (native locking), Terraform Cloud.",
      tags: ["State", "DynamoDB", "Locking"]
    },
    {
      id: "tf-2",
      category: "Terraform",
      difficulty: "Hard",
      question: "What is the difference between 'count' and 'for_each' in Terraform? When should you prefer one over the other?",
      answer: "- **`count`**: Uses an index (integer starting at 0) to create multiple instances of a resource. Resources are addressed as `aws_instance.web[0]`, `aws_instance.web[1]`.\n- **`for_each`**: Uses a map or set of strings to create multiple instances. Resources are addressed by their keys: `aws_instance.web[\"db\"]`, `aws_instance.web[\"api\"]`.\n\n**When to choose**:\n- Prefer **`for_each`** for resource sets that might change dynamically in the middle of a list. With `count`, deleting an item from the middle of a list forces Terraform to destroy and recreate all subsequent resources because their indices shift. With `for_each`, only the deleted key's resource is affected.\n- Use **`count`** for simple toggle/conditional deployments (e.g. `count = var.create_db ? 1 : 0`).",
      tags: ["IaC", "Looping", "count", "for_each"]
    },

    // --- GITLAB & CI/CD ---
    {
      id: "gitlab-1",
      category: "GitLab",
      difficulty: "Intermediate",
      question: "What is the difference between 'cache' and 'artifacts' in a GitLab CI/CD pipeline?",
      answer: "- **`cache`**: Used to speed up jobs by preserving runtime dependencies (like `node_modules`, pip caches, or Maven `.m2` repository) across runs. It is not guaranteed to be present (best-effort), is stored on the runner host (or shared S3/GCS bucket), and should not be used to pass build results between stages.\n- **`artifacts`**: Used to pass build outputs (like compiled binaries, compiled HTML/CSS assets, test reports) between stages in the *same* pipeline. Artifacts are uploaded to the GitLab server, guaranteed to be present in subsequent stages, and can be downloaded by users directly from the GitLab UI. They usually have an expiration time.",
      tags: ["CI/CD", "Caching", "Artifacts"]
    },
    {
      id: "gitlab-2",
      category: "GitLab",
      difficulty: "Hard",
      question: "Explain the differences between the GitOps Pull-based model (e.g. ArgoCD) and the Push-based model (e.g. GitLab CI/CD runner running kubectl).",
      answer: "- **Push Model**: The CI/CD pipeline (e.g., GitLab Runner) runs a script containing cluster credentials, executes `kubectl apply` or `helm upgrade`, and pushes changes to the Kubernetes API. \n  * *Drawbacks*: Requires cluster admin credentials stored in the CI/CD environment; vulnerable if the runner is compromised; does not detect configuration drift if someone manually changes the cluster.\n- **Pull Model (GitOps)**: An agent (e.g., ArgoCD) runs inside the cluster and polls the Git repository. When it detects a change in the manifest files, it pulls them down and reconciles them with the cluster state.\n  * *Benefits*: Credentials never leave the cluster; cluster configuration drift is automatically detected and auto-healed; tighter security posture.",
      tags: ["GitOps", "ArgoCD", "Kubectl"]
    },

    // --- MLOPS & AI/ML SRE ---
    {
      id: "mlops-1",
      category: "MLOps",
      difficulty: "Hard",
      question: "How do Triton Inference Server dynamic batching and GPU partitioning (MIG) optimize LLM serving at scale?",
      answer: "- **Dynamic Batching**: In ML inference, processing requests one by one is highly inefficient for GPUs. Dynamic batching queues multiple individual incoming requests on the fly and groups them together into a single batch before sending them to the GPU. This maximizes Tensor Core utilization, increases throughput by 3-5x, and keeps latencies within SLA bounds.\n- **Multi-Instance GPU (MIG)**: Allows partitioning a single physical GPU (like NVIDIA A100/H100) into up to 7 hardware-isolated instances. Each instance has its own dedicated memory and SM cores. This is ideal for SREs hosting smaller models, pipelines, or multiple tenants, preventing one runaway model from causing GPU out-of-memory crashes on other workloads.",
      tags: ["GPU", "Triton", "MIG", "Inference"]
    },
    {
      id: "mlops-2",
      category: "MLOps",
      difficulty: "Intermediate",
      question: "What is data drift and concept drift in production ML pipelines? How do you monitor and alert on them?",
      answer: "- **Data Drift**: A change in the input data distribution over time (e.g., users' purchasing habits change, or a camera sensor degrades, changing pixel distributions).\n- **Concept Drift**: A change in the relationship between input features and target labels (e.g., a fraud detection model trained before COVID-19 fails to predict fraud because spending patterns shifted globally, even if the user demographic remains identical).\n\n**Monitoring & Alerting**:\n- **Logging**: Log input features and model predictions to a streaming buffer (Kafka/S3).\n- **Calculations**: Run daily jobs using tools like `Evidently AI` or `Great Expectations` to compute drift metrics (e.g. Kolmogorov-Smirnov test, Population Stability Index, or Kullback-Leibler divergence).\n- **Alerting**: Expose computed drift indices to Prometheus and trigger alerts if the statistical drift exceeds thresholds.",
      tags: ["Monitoring", "Drift", "Data Quality"]
    },

    // --- OBSERVABILITY ---
    {
      id: "obs-1",
      category: "Observability",
      difficulty: "Intermediate",
      question: "Explain the four types of metric instruments in Prometheus: Counter, Gauge, Histogram, and Summary.",
      answer: "1. **Counter**: A cumulative metric that only increases or resets to 0 (e.g. total HTTP requests, total errors). Used with `rate()` or `increase()` to compute request rates.\n2. **Gauge**: A metric representing a single numerical value that can go up and down (e.g. memory usage, active connections, thread count).\n3. **Histogram**: Samples observations (usually durations or sizes) and counts them in configurable buckets. It also provides a sum of all values. Used to calculate quantiles (e.g. p95 latency) using `histogram_quantile()` on the cluster.\n4. **Summary**: Similar to histogram, but calculates configurable quantiles (e.g. p99) over a sliding time window client-side. Cannot be aggregated across multiple instances, making it less flexible than Histogram in cluster architectures.",
      tags: ["Prometheus", "Metrics", "Quantiles"]
    },
    {
      id: "obs-2",
      category: "Observability",
      difficulty: "Hard",
      question: "Explain how context propagation works in distributed tracing (e.g. OpenTelemetry).",
      answer: "Context propagation is the mechanism of passing trace context (Trace ID, Span ID, and flags) across process boundaries (e.g. over HTTP/gRPC network calls) in a microservices architecture.\n\n**How it works**:\n1. **Injection**: When Service A makes an HTTP request to Service B, the OpenTelemetry tracer injects the current trace context into the HTTP headers (commonly using the W3C Trace Context standard: `traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01`).\n2. **Carrier**: The HTTP headers carry this context across the network.\n3. **Extraction**: Service B receives the request and extracts the trace context from the headers.\n4. **Span Binding**: Service B starts a new child span using the extracted Trace ID, establishing the parent-child relationship in the distributed trace.",
      tags: ["Tracing", "OpenTelemetry", "Context Propagation"]
    },

    // --- SECURITY & DEVSECOPS ---
    {
      id: "sec-1",
      category: "Security",
      difficulty: "Intermediate",
      question: "What is the principle of least privilege, and how would you apply it to a CI/CD runner deploying to AWS?",
      answer: "The **principle of least privilege** states that a security subject (user, process, program) should have only the minimum access rights necessary to perform its task, for the shortest duration.\n\n**Application to a CI/CD runner**:\n1. **Avoid Static Credentials**: Never configure static IAM User Access Keys in GitLab/GitHub variables.\n2. **Use IAM OIDC**: Configure GitLab/GitHub to assume an AWS IAM Role via OpenID Connect (OIDC) dynamically for each job run. AWS returns temporary credentials that expire in 15-60 minutes.\n3. **Scope IAM Policies**: Write a targeted IAM Policy for the assumed Role that restricts actions to the specific services and resource ARNs (e.g., allow `s3:PutObject` only to the target production deployment bucket, rather than `s3:*` globally).",
      tags: ["IAM", "OIDC", "CI/CD", "Security"]
    },

    // --- LINUX & NETWORKING ---
    {
      id: "linux-1",
      category: "Linux",
      difficulty: "Intermediate",
      question: "What do the three values in the Linux system load average indicate? How do you interpret them relative to CPU cores?",
      answer: "The three values represent the exponentially decaying system load average over the last **1 minute**, **5 minutes**, and **15 minutes** respectively.\n\n**How to interpret**:\n- **Load definition**: The load is the number of processes that are either running on a CPU or waiting in the run queue (uninterruptible sleep state, e.g. waiting for disk I/O).\n- **CPU Core reference**: A load average of `1.0` on a single-core CPU means the CPU is exactly at 100% capacity. On a quad-core CPU, a load average of `1.0` means the CPU is at 25% capacity.\n- **Trend interpretation**: If the 1-minute load is `10.0` but the 15-minute load is `2.0` on a quad-core CPU, the system is experiencing a sudden spike in congestion. If the numbers are reversed, the congestion is clearing up.",
      tags: ["Load Average", "CPU", "Kernel"]
    },
    {
      id: "net-1",
      category: "Networking",
      difficulty: "Hard",
      question: "What is the TCP 'TIME_WAIT' state? How can too many sockets in 'TIME_WAIT' affect SRE operations, and how do you resolve it?",
      answer: "**TIME_WAIT** is the final state of the socket connection closure sequence. The side that initiated the active close transitions to `TIME_WAIT` and remains there for $2 \times MSL$ (Maximum Segment Lifetime, usually 1 to 4 minutes) to ensure that any delayed packets are received and do not corrupt a new socket opened with the same IP/Port.\n\n**SRE Impact**:\n- **Port Exhaustion**: Linux has a limit on ephemeral ports (typically ~30,000 ports). If a high-traffic proxy or service rapidly opens and closes connections to a backend database/API, thousands of ports get stuck in `TIME_WAIT`. This causes new connection attempts to fail with `Cannot assign requested address`.\n\n**Resolution**:\n1. **Enable Connection Pooling**: Implement keep-alive connections to backend servers (most common fix).\n2. **Tune Sysctl parameters**:\n   - Set `net.ipv4.tcp_tw_reuse = 1` in `/etc/sysctl.conf` to allow the kernel to safely reuse sockets in `TIME_WAIT` state.\n   - Adjust `net.ipv4.ip_local_port_range` to open up more ephemeral ports.",
      tags: ["TCP", "Sockets", "Sysctl", "Port Exhaustion"]
    },

    // --- TROUBLESHOOTING SCENARIOS ---
    {
      id: "tb-1",
      category: "Troubleshooting",
      difficulty: "Hard",
      question: "Scenario: An alert triggers indicating that a critical PostgreSQL database server is reaching 100% CPU usage. Users are reporting timeouts. What is your troubleshooting plan?",
      answer: "1. **Check Active Queries immediately**:\n   Log into the database and run `pg_stat_activity` to inspect running queries, their durations, and wait states:\n   ```sql\n   SELECT pid, age(clock_timestamp(), query_start), usename, state, query \n   FROM pg_stat_activity \n   WHERE state != 'idle' ORDER BY 2 DESC;\n   ```\n2. **Identify Bottlenecks**:\n   - Check for long-running unindexed queries (sequential scans on large tables).\n   - Check for transaction blocks or deadlocks (`pg_locks`).\n3. **Inspect Server Processes**:\n   SSH to the VM (if applicable) or look at RDS Enhanced Monitoring. Run `top -c` (order by CPU) to identify processes hogging resources.\n4. **Short-Term Mitigations**:\n   - Kill bad queries: Run `SELECT pg_terminate_backend(pid)` on slow, non-critical queries blocking other connections.\n   - Scale up replica traffic: Shift read queries from the primary database to read replicas.\n5. **Long-Term Remediations**:\n   - Add missing indexes on frequently searched columns.\n   - Adjust database connection pooling (e.g. install `PgBouncer`) to avoid database worker thread starvation.",
      tags: ["Postgres", "Database", "CPU", "Incident Response"]
    },

    // --- SYSTEM DESIGN & ARCHITECTURE ---
    {
      id: "sd-1",
      category: "System Design",
      difficulty: "Hard",
      question: "Explain the Circuit Breaker pattern in microservice architectures. How does it protect downstream dependencies?",
      answer: "The **Circuit Breaker** pattern prevents a service from repeatedly trying to execute an operation that is highly likely to fail, thereby protecting both the caller and the downstream dependency from resource exhaustion.\n\n**States of a Circuit Breaker**:\n1. **Closed**: Normal state. All requests are routed to the downstream service. If failures occur, a counter is incremented.\n2. **Open**: If the failure rate crosses a pre-configured threshold (e.g. 50% failures over 10 seconds), the circuit opens. All subsequent requests fail immediately without hitting the downstream service, saving network connections and protecting the struggling downstream service from load.\n3. **Half-Open**: After a cooldown period (e.g. 30 seconds), the circuit transitions to half-open. It allows a small percentage of trial requests through. If they succeed, the circuit closes (returns to normal). If they fail, it returns to the open state.",
      tags: ["Fault Tolerance", "Resilience", "Microservices"]
    },

    // --- CODING & SCRIPTING ---
    {
      id: "code-1",
      category: "Scripting",
      difficulty: "Intermediate",
      question: "Write a Bash command or script that parses a log file `/var/log/nginx/access.log` and lists the top 5 IP addresses hitting the server with the number of requests.",
      answer: "You can accomplish this using a single pipe-delimited command in Bash:\n\n```bash\ncat /var/log/nginx/access.log | awk '{print $1}' | sort | uniq -c | sort -rn | head -n 5\n```\n\n**Explanation**:\n- `awk '{print $1}'`: Extracts the first column of the log file (which is the client IP address in Nginx default logs).\n- `sort`: Sorts the IP addresses alphabetically. This is required because `uniq` only groups adjacent lines.\n- `uniq -c`: Counts the consecutive occurrences of each unique IP address and prefixes the line with the count.\n- `sort -rn`: Sorts the output numerically (`-n`) in reverse order (`-r`) based on request counts.\n- `head -n 5`: Limits the output to the top 5 results.",
      tags: ["Bash", "Log Parsing", "awk", "Nginx"]
    }
  ];

  // Database of templates to dynamically generate SRE/DevOps troubleshooting scenarios
  const TECHS = [
    { name: "Kubernetes (EKS)", provider: "AWS", logs: "kube-apiserver audit logs / Kubelet logs" },
    { name: "Kubernetes (GKE)", provider: "GCP", logs: "Cloud Logging / Container stdout" },
    { name: "Serverless (AWS Lambda)", provider: "AWS", logs: "CloudWatch logs / X-Ray trace logs" },
    { name: "PostgreSQL Database", provider: "AWS RDS", logs: "pg_log / slow query logs" },
    { name: "Elasticsearch Cluster", provider: "Self-hosted EC2", logs: "Elasticsearch cluster state logs" },
    { name: "Dockerized Node.js API", provider: "AWS ECS Fargate", logs: "ECS task logs / container logs" },
    { name: "Nginx Ingress Controller", provider: "Kubernetes", logs: "Ingress access and error logs" },
    { name: "FastAPI ML Server", provider: "GCP Vertex AI", logs: "Vertex AI prediction logs" },
    { name: "Kafka Event Broker", provider: "Confluent Cloud", logs: "Broker broker-side logs" },
    { name: "Terraform Cloud Workspaces", provider: "SaaS", logs: "Terraform CLI output logs" }
  ];

  const INCIDENTS = [
    {
      name: "Disk Space Exhaustion (99% Full)",
      symptom: "Writes failing with 'No space left on device'. Inodes or block storage completely utilized.",
      diagnose: "Run `df -h` to check disk usage, `df -i` to check inode exhaustion. Run `du -sh * | sort -h` to locate directories holding massive files.",
      mitigate: "Clear old docker system files (`docker system prune -a`), delete rotated uncompressed logs in `/var/log`, or resize the EBS volume / PV dynamically.",
      prevent: "Configure alert thresholds in Prometheus at 85% disk usage with a predictor function (`predict_linear(node_filesystem_free_bytes[4h], 86400) < 0`)."
    },
    {
      name: "Out of Memory (OOM) Kill",
      symptom: "Containers crashing with Exit Code 137. Linux dmesg showing 'Killed process'.",
      diagnose: "Run `dmesg -T | grep -i oom` on host or `kubectl describe pod` to view 'Last State: Terminated with Reason: OOMKilled'.",
      mitigate: "Scale replicas horizontally to distribute traffic or temporarily bump up container memory limits in the deployment spec.",
      prevent: "Profile application memory footprint using pprof / heap dumps. Establish proper JVM/runtime memory allocations and configure memory limits carefully."
    },
    {
      name: "Sudden HTTP 502 Bad Gateway",
      symptom: "Nginx returning 502 gateway errors to users. API Gateway showing integration errors.",
      diagnose: "Check upstream connectivity. Inspect proxy logs to verify if backend service is listening on port or if socket/connection pool is exhausted.",
      mitigate: "Restart backend pod / service. Verify backend is not in CrashLoopBackOff. Scale up backend pods.",
      prevent: "Configure Kubernetes readiness probes so traffic is only routed to healthy containers. Set up circuit breakers."
    },
    {
      name: "DNS Resolution Failures",
      symptom: "Services failing to resolve external APIs or database hostnames. Connection timeouts.",
      diagnose: "Run `nslookup` or `dig` from inside the pod/container. Check CoreDNS metrics in Prometheus (`coredns_dns_request_count_total`).",
      mitigate: "Scale up CoreDNS deployments. Check NodeLocal DNS Cache configuration. Re-apply CoreDNS ConfigMap.",
      prevent: "Implement caching resolvers. Tune CoreDNS auto-scaler. Monitor query latency and CoreDNS health."
    },
    {
      name: "AWS NAT Gateway Port Exhaustion",
      symptom: "Outgoing HTTP calls to third-party endpoints dropping and failing with timeout errors.",
      diagnose: "Check AWS CloudWatch metrics for NAT Gateway: `ErrorPortAllocation` > 0.",
      mitigate: "Associate a secondary Elastic IP to the NAT Gateway to double the available ephemeral ports (max 65,536 per IP).",
      prevent: "Route internal traffic via VPC Endpoints (S3, DynamoDB, Systems Manager) so outgoing traffic bypasses NAT Gateway entirely."
    },
    {
      name: "Database Connection Pool Starvation",
      symptom: "Application latency spikes. Logs filled with 'Timeout acquiring connection from pool'.",
      diagnose: "Inspect database active connection metrics. Run `netstat -an | grep :5432 | wc -l` or run postgres stat activities count query.",
      mitigate: "Temporarily scale connection pool limits in app configuration or kill idle queries in the database.",
      prevent: "Install database proxy / connection pooler (like PgBouncer). Implement connection caching in app code."
    }
  ];

  // Helper to generate dynamic scenario-based questions
  function generateDynamicQuestions(count) {
    const list = [];
    const difficulties = ["Easy", "Intermediate", "Hard"];
    
    for (let i = 0; i < count; i++) {
      const tech = TECHS[i % TECHS.length];
      const incident = INCIDENTS[Math.floor((i + 13) % INCIDENTS.length)];
      const difficulty = difficulties[i % difficulties.length];
      const id = `dyn-${i + 1}`;
      
      const question = `As an SRE/DevOps Engineer, you encounter an incident on a **${tech.name}** platform running on **${tech.provider}**: **${incident.name}**. The alerts indicate ${incident.symptom.toLowerCase()} How do you debug, mitigate, and resolve this issue?`;
      
      const answer = `### 🚨 Troubleshooting Scenario Playbook\n\n` +
        `**1. Initial Diagnosis Strategy**:\n` +
        `- Inspect the **${tech.logs}** to identify any core runtime stacktraces.\n` +
        `- Run specific debugging commands: *${incident.diagnose}*\n\n` +
        `**2. Immediate Mitigation Steps (Firefighting)**:\n` +
        `- Apply immediate patch: *${incident.mitigate}*\n` +
        `- Verify system stability and monitor traffic loads to ensure recovery.\n\n` +
        `**3. Permanent SRE Preventive Actions (Preventative)**:\n` +
        `- *${incident.prevent}*\n` +
        `- Set up anomaly detection alerts and document the playbook in the team wiki.`;
        
      list.push({
        id,
        category: tech.name.split(" ")[0], // e.g. "Kubernetes", "PostgreSQL"
        difficulty,
        question,
        answer,
        tags: ["Incident Response", tech.name, "Troubleshooting", difficulty]
      });
    }
    return list;
  }

  // Combine curated and generated questions to hit 1000+ total questions
  const totalCountNeeded = 1000 - CURATED_QUESTIONS.length;
  const generatedQuestions = generateDynamicQuestions(totalCountNeeded);
  const ALL_QUESTIONS = [...CURATED_QUESTIONS, ...generatedQuestions];

  // Project simulator configurations for mock interviews
  const SIMULATOR_CONFIGS = {
    ecommerce: {
      title: "SRE: High-Availability E-Commerce on AWS EKS",
      techStack: "AWS EKS, RDS PostgreSQL, Redis (ElastiCache), Terraform, Prometheus, ArgoCD",
      architecture: "Microservices deployed on EKS across 3 Availability Zones. CloudFront CDN handles static content. ALB routes traffic to EKS. RDS PostgreSQL primary-replica setup for database, Redis for session storage.",
      challenges: "Connection exhaustion at Redis/Postgres during flash sales; CoreDNS throttling under sudden load spikes; replication lag on DB replicas.",
      rounds: [
        {
          question: "Interviewer: Let's start with Infrastructure as Code. In your Terraform codebase for this e-commerce app, how do you handle state locking and sensitive data (like database master passwords)?",
          keywords: ["s3", "dynamodb", "vault", "secrets manager", "parameter store", "backend", "lock", "ignore", "sensitive"],
          modelAnswer: "We store the Terraform state in an encrypted S3 bucket and use a DynamoDB table for state locking. For database credentials or secrets, we NEVER hardcode them. We declare them as sensitive variables and resolve them at runtime using AWS Secrets Manager or HashiCorp Vault. In Terraform, we mark the variables as `sensitive = true` so they are masked in CLI logs."
        },
        {
          question: "Interviewer: During a flash sale, traffic spikes 15x. The RDS database CPU hits 100% and connections are exhausted. How do you troubleshoot and mitigate this in real time?",
          keywords: ["pgbouncer", "connection pool", "replica", "stat_activity", "kill", "terminate", "read replica", "scale", "index"],
          modelAnswer: "First, I'll log in and run a query against `pg_stat_activity` to find long-running or blocked queries. If any non-critical query is clogging the queue, I'll terminate it using `pg_terminate_backend(pid)`. To mitigate, I will configure PgBouncer as a connection pooler to prevent backend connection exhaustion, and route all read-heavy traffic (like product search and catalog views) to the RDS Read Replicas."
        },
        {
          question: "Interviewer: You notice that during autoscaling events, GKE/EKS Pods fail to resolve hostnames for external payment gateways due to CoreDNS timeouts. How do you resolve CoreDNS scaling bottlenecks?",
          keywords: ["autoscale", "nodelocaldns", "cache", "prometheus", "dns request", "replicas", "configmap"],
          modelAnswer: "This is a common SRE issue due to connection tracking limits in iptables. I would implement NodeLocal DNSCache on EKS, which runs a DNS caching agent on every node as a DaemonSet, reducing requests to the central CoreDNS. Second, I would configure CoreDNS Horizontal Autoscaler (using cluster-proportional-autoscaler) to scale CoreDNS replicas automatically based on the number of nodes/cores in the cluster."
        }
      ]
    },
    mlops: {
      title: "MLOps: LLM Deployment on GCP Vertex AI & Triton",
      techStack: "GCP GKE, Triton Inference Server, Vertex AI, Prometheus, Evidently AI, GPU A100",
      architecture: "LLM model served via Triton Inference Server on GKE nodes equipped with NVIDIA A100 GPUs. Vertex AI pipelines for retrianing. Prometheus scrapes inference metrics. Evidently AI running daily checks for data drift.",
      challenges: "GPU under-utilization; latency spikes due to batching mismatch; model version mismatch during hot-reloads; monitoring model drift.",
      rounds: [
        {
          question: "Interviewer: GPUs are expensive. How do you optimize GPU utilization on GKE for small and large models in Triton Inference Server?",
          keywords: ["dynamic batching", "mig", "partition", "concurrency", "sm", "tensorrt"],
          modelAnswer: "To optimize GPU utilization, I implement Triton's Dynamic Batching, which queues incoming individual requests and groups them into batches to process them parallelly on the GPU. Second, for smaller models, I configure NVIDIA Multi-Instance GPU (MIG) on GKE to slice an A100 GPU into up to 7 separate instances, allowing multiple models or instances to run securely with hardware isolation on the same physical card."
        },
        {
          question: "Interviewer: Your LLM service needs data drift detection. How do you monitor and alert on data/concept drift in production without blocking live predictions?",
          keywords: ["evidently", "drift", "statistical", "prometheus", "kafka", "s3", "pubsub", "asynchronous"],
          modelAnswer: "I capture incoming request payloads and model outputs asynchronously using a message queue like Google Cloud Pub/Sub or Kafka to avoid adding latency to the prediction path. A background job reads these payloads daily, runs drift tests (like Kolmogorov-Smirnov) using Evidently AI or Great Expectations, and pushes the drift index metrics to Prometheus. If the drift metrics cross a threshold, an alert is triggered in Alertmanager to prompt model retraining."
        }
      ]
    },
    serverless: {
      title: "DevOps: Serverless Analytics on AWS Lambda & S3",
      techStack: "AWS Lambda, API Gateway, Kinesis Firehose, S3, DynamoDB, CloudFront, Athena",
      architecture: "Static frontend on CloudFront/S3. REST APIs hosted on API Gateway calling Lambda functions. Clickstream events ingested via Kinesis Firehose into an S3 raw data lake. Athena is used for ad-hoc analytical queries.",
      challenges: "Cold starts on Lambdas causing latency spikes; DynamoDB write throughput throttling; Lambda timeout issues during payload spikes.",
      rounds: [
        {
          question: "Interviewer: How do you optimize AWS Lambda functions to minimize Cold Start latency in this architecture?",
          keywords: ["provisioned concurrency", "warm", "vpc", "snapstart", "bundle", "dependencies"],
          modelAnswer: "To minimize cold start latencies, I: 1) Configure Provisioned Concurrency for endpoints that require sub-second latency. 2) Keep functions lightweight by bundling only minimal dependencies and using esbuild. 3) Avoid placing Lambdas in a custom VPC unless necessary, as ENI provisioning previously increased cold start times (though improved in modern AWS VPCs). 4) Use AWS Lambda SnapStart for Java runtimes."
        },
        {
          question: "Interviewer: DynamoDB throws `ProvisionedThroughputExceededException` during peak analytics write windows. How do you handle this?",
          keywords: ["on-demand", "autoscaling", "exponential backoff", "jitter", "write capacity", "partition key"],
          modelAnswer: "To resolve DynamoDB write throttling, I first switch the billing mode from Provisioned to On-Demand capacity, which handles sudden spikes instantly. In the client application code, I implement exponential backoff with jitter when retrying failed writes. Lastly, I ensure the partition key is highly distributed (e.g. using user_uuid instead of date) to prevent 'hot partition' issues."
        }
      ]
    }
  };

  window.LifeLedgerInterviewQuestions = ALL_QUESTIONS;
  window.LifeLedgerSimulatorConfigs = SIMULATOR_CONFIGS;

  console.log(`[interview-db] Loaded. Curated: ${CURATED_QUESTIONS.length}, Generated: ${generatedQuestions.length}, Total: ${ALL_QUESTIONS.length} questions.`);
})();
