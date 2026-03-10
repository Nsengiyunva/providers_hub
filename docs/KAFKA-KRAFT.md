# Kafka Without ZooKeeper (KRaft Mode)

## What Changed?

**You're absolutely correct!** Kafka no longer requires ZooKeeper as of version 3.3+ (released in 2022). This EventHub backend now uses **Kafka in KRaft mode** (Kafka Raft).

## Why the Change?

### The Old Way (with ZooKeeper)
```
Client → Kafka Broker → ZooKeeper
                         ↑
                    (metadata storage)
```

**Problems:**
- Extra infrastructure to manage
- Additional operational complexity
- Split-brain scenarios
- More points of failure
- Slower metadata propagation

### The New Way (KRaft)
```
Client → Kafka Broker
         ↓
    (self-managed metadata)
```

**Benefits:**
- ✅ Simpler architecture
- ✅ Faster metadata operations
- ✅ Better scalability (supports millions of partitions)
- ✅ Reduced operational overhead
- ✅ Faster recovery times
- ✅ One less thing to monitor

## What This Means for EventHub

### Before (with ZooKeeper)
```yaml
services:
  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    ports:
      - "2181:2181"
  
  kafka:
    image: confluentinc/cp-kafka:7.5.0
    depends_on:
      - zookeeper
    environment:
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
```

### Now (KRaft mode)
```yaml
services:
  kafka:
    image: confluentinc/cp-kafka:7.5.0
    environment:
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@kafka:29093
      # No ZooKeeper needed!
```

## Configuration Details

### KRaft-Specific Settings

```yaml
# Node configuration
KAFKA_NODE_ID: 1                           # Unique node ID
KAFKA_PROCESS_ROLES: broker,controller     # This node acts as both

# Controller quorum (consensus)
KAFKA_CONTROLLER_QUORUM_VOTERS: 1@kafka:29093
KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER

# Cluster ID (must be consistent across cluster)
CLUSTER_ID: 'MkU3OEVBNTcwNTJENDM2Qk'
```

### What Each Setting Means

**KAFKA_NODE_ID**
- Unique identifier for this Kafka node
- Used in the controller quorum

**KAFKA_PROCESS_ROLES**
- `broker`: Handles client requests (produce/consume)
- `controller`: Manages metadata
- Can be both (combined mode) or separate nodes

**KAFKA_CONTROLLER_QUORUM_VOTERS**
- List of controller nodes
- Format: `id@host:port`
- Must be odd number for quorum (1, 3, 5, etc.)

**CLUSTER_ID**
- Unique ID for the Kafka cluster
- Generated once, used forever
- All nodes must have the same ID

## First-Time Startup

Kafka KRaft requires storage formatting on first startup:

```bash
# Format storage (one time)
kafka-storage format -t <CLUSTER_ID> -c /etc/kafka/kraft/server.properties

# Then start Kafka
/etc/confluent/docker/run
```

Our Docker Compose handles this automatically:
```yaml
command: >
  bash -c "
    if [ ! -f /var/lib/kafka/data/meta.properties ]; then
      kafka-storage format -t MkU3OEVBNTcwNTJENDM2Qk -c /etc/kafka/kraft/server.properties
    fi
    /etc/confluent/docker/run
  "
```

## Migration from ZooKeeper

If you had the old setup with ZooKeeper:

### 1. Stop Old Setup
```bash
docker-compose down -v
```

### 2. Update to New docker-compose.yml
(Already done in this package!)

### 3. Start New Setup
```bash
docker-compose up -d kafka
```

### 4. Verify Kafka is Running
```bash
# Check logs
docker-compose logs -f kafka

# Look for: "Kafka Server started"

# Test connection
docker exec -it eventhub-kafka \
  kafka-broker-api-versions --bootstrap-server localhost:9092
```

## Production Considerations

### Single Node (Development)
```yaml
# What we use - simple single node
KAFKA_PROCESS_ROLES: broker,controller
```

### Multi-Node (Production)
For production, use separate controller and broker nodes:

```yaml
# Controller nodes (3 nodes for quorum)
controller-1:
  KAFKA_PROCESS_ROLES: controller
  KAFKA_NODE_ID: 1

controller-2:
  KAFKA_PROCESS_ROLES: controller
  KAFKA_NODE_ID: 2

controller-3:
  KAFKA_PROCESS_ROLES: controller
  KAFKA_NODE_ID: 3

# Broker nodes (scale as needed)
broker-1:
  KAFKA_PROCESS_ROLES: broker
  KAFKA_NODE_ID: 101

broker-2:
  KAFKA_PROCESS_ROLES: broker
  KAFKA_NODE_ID: 102
```

## Commands (No ZooKeeper!)

### Create Topic
```bash
docker exec -it eventhub-kafka \
  kafka-topics --create \
  --topic user-events \
  --bootstrap-server localhost:9092 \
  --partitions 3 \
  --replication-factor 1
```

### List Topics
```bash
docker exec -it eventhub-kafka \
  kafka-topics --list \
  --bootstrap-server localhost:9092
```

### Describe Topic
```bash
docker exec -it eventhub-kafka \
  kafka-topics --describe \
  --topic user-events \
  --bootstrap-server localhost:9092
```

### Consume Messages
```bash
docker exec -it eventhub-kafka \
  kafka-console-consumer \
  --topic user-events \
  --from-beginning \
  --bootstrap-server localhost:9092
```

### Produce Messages
```bash
docker exec -it eventhub-kafka \
  kafka-console-producer \
  --topic user-events \
  --bootstrap-server localhost:9092
```

## Monitoring

### Check Cluster Metadata
```bash
docker exec -it eventhub-kafka \
  kafka-metadata --snapshot /var/lib/kafka/data/__cluster_metadata-0/00000000000000000000.log
```

### Check Controller Status
```bash
docker exec -it eventhub-kafka \
  kafka-broker-api-versions --bootstrap-server localhost:9092
```

## Troubleshooting

### Issue: Kafka won't start

**Check logs:**
```bash
docker-compose logs kafka
```

**Common issues:**
1. **Storage not formatted**
   - Solution: Delete volume and restart
   ```bash
   docker-compose down -v
   docker-compose up -d kafka
   ```

2. **Port already in use**
   - Solution: Change port mapping
   ```yaml
   ports:
     - "9094:9092"  # Use different host port
   ```

3. **Cluster ID mismatch**
   - Solution: Use consistent CLUSTER_ID across all nodes

### Issue: Can't connect from services

**Verify listeners:**
```bash
docker exec -it eventhub-kafka env | grep KAFKA_LISTENERS
```

**Should see:**
```
KAFKA_LISTENERS=PLAINTEXT://kafka:29092,CONTROLLER://kafka:29093,PLAINTEXT_HOST://0.0.0.0:9092
KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://kafka:29092,PLAINTEXT_HOST://localhost:9092
```

## Performance Benefits

### Metadata Operations
- **Before (ZooKeeper)**: 100ms+ for metadata updates
- **Now (KRaft)**: 10-20ms for metadata updates

### Partition Scalability
- **Before (ZooKeeper)**: Limited to ~200K partitions
- **Now (KRaft)**: Supports millions of partitions

### Recovery Time
- **Before (ZooKeeper)**: Minutes for large clusters
- **Now (KRaft)**: Seconds to recover

## References

- [Kafka KRaft Documentation](https://kafka.apache.org/documentation/#kraft)
- [KIP-500: Replace ZooKeeper with Self-Managed Metadata Quorum](https://cwiki.apache.org/confluence/display/KAFKA/KIP-500%3A+Replace+ZooKeeper+with+a+Self-Managed+Metadata+Quorum)
- [Confluent KRaft Guide](https://docs.confluent.io/platform/current/kafka-metadata/kraft.html)

## Summary

✅ **Modern Kafka (KRaft mode)**
- No ZooKeeper dependency
- Simpler architecture
- Better performance
- Production-ready (GA since Kafka 3.3)

❌ **Old Kafka (with ZooKeeper)**
- Deprecated approach
- Extra complexity
- Will be removed in Kafka 4.0

**EventHub now uses the modern, ZooKeeper-free Kafka!** 🚀
