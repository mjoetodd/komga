package org.gotson.komga.domain.service

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import java.nio.file.Files
import java.nio.file.Path
import java.time.Instant
import java.util.UUID
import kotlin.io.path.exists
import kotlin.io.path.name
import kotlin.io.path.readText

private val logger = KotlinLogging.logger {}

/**
 * Bridges Komga and the external character/audiobook worker over a shared
 * directory (default /worker, env KOMGA_WORKER_DIR): Komga drops job JSON
 * files into jobs/, the worker executes them one at a time and reports
 * progress in status/<jobId>.json.
 */
@Service
class CharacterJobService {
  private val objectMapper = ObjectMapper()

  val workerDir: Path = Path.of(System.getenv("KOMGA_WORKER_DIR") ?: "/worker")
  private val jobsDir get() = workerDir.resolve("jobs")
  private val statusDir get() = workerDir.resolve("status")

  fun isAvailable(): Boolean = jobsDir.exists()

  /** Container book folders are bind mounts; translate to the host path the worker sees. */
  fun hostSeriesDir(containerParent: Path): String? {
    val p = containerParent.toString()
    val roots = mapOf(
      "/books" to "/mnt/user/books",
      "/comics" to "/mnt/user/comics",
      "/manga" to "/mnt/user/manga",
    )
    for ((prefix, host) in roots) {
      if (p == prefix || p.startsWith("$prefix/")) return host + p.removePrefix(prefix)
    }
    return null
  }

  fun slugify(title: String): String =
    title
      .lowercase()
      .replace(Regex("[^a-z0-9]+"), "-")
      .trim('-')
      .replace(Regex("-+"), "-")

  data class JobBook(
    val file: String,
    val number: Int?,
    val force: Boolean = false,
  )

  fun submit(
    type: String,
    seriesSlug: String,
    seriesName: String,
    seriesDirHost: String,
    books: List<JobBook>,
    extra: Map<String, String> = emptyMap(),
  ): String {
    val id = "job-" + UUID.randomUUID().toString().take(8)
    val root = objectMapper.createObjectNode()
    root.put("id", id)
    root.put("type", type)
    root.put("seriesSlug", seriesSlug)
    root.put("seriesName", seriesName)
    root.put("seriesDir", seriesDirHost)
    root.put("createdAt", Instant.now().toString())
    val arr = root.putArray("books")
    books.forEach { b ->
      val node = arr.addObject()
      node.put("file", b.file)
      b.number?.let { node.put("number", it) }
      node.put("force", b.force)
    }
    extra.forEach { (k, v) -> root.put(k, v) }
    Files.createDirectories(jobsDir)
    val tmp = jobsDir.resolve("$id.json.tmp")
    Files.writeString(tmp, objectMapper.writeValueAsString(root))
    Files.move(tmp, jobsDir.resolve("$id.json"))
    logger.info { "Submitted character job $id ($type, ${books.size} books, series $seriesSlug)" }
    return id
  }

  private val scanClaimed = java.util.Collections.synchronizedSet(mutableSetOf<String>())

  /**
   * Returns true exactly once per job id — used to fire a one-off library
   * scan when a generate job finishes, so Komga indexes the new audiobook
   * sidecars (cover decorator, book flags) without waiting for a manual scan.
   */
  fun claimScanTrigger(jobId: String): Boolean = scanClaimed.add(jobId)

  fun readStatus(jobId: String): JsonNode? {
    val f = statusDir.resolve("$jobId.json")
    if (!f.exists()) return null
    return try {
      objectMapper.readTree(f.readText())
    } catch (e: Exception) {
      null
    }
  }

  /** Recent jobs (pending + done) whose stored payload names this series slug, newest first. */
  fun recentJobsForSlug(slug: String, limit: Int = 5): List<JsonNode> {
    val candidates = mutableListOf<Path>()
    listOf(jobsDir, jobsDir.resolve("done")).forEach { dir ->
      if (dir.exists()) {
        Files.list(dir).use { stream ->
          stream
            .filter { it.name.endsWith(".json") }
            .forEach { candidates.add(it) }
        }
      }
    }
    return candidates
      .mapNotNull { path ->
        try {
          val node = objectMapper.readTree(path.readText())
          if (node.path("seriesSlug").asText() == slug) node else null
        } catch (e: Exception) {
          null
        }
      }
      .sortedByDescending { it.path("createdAt").asText("") }
      .take(limit)
  }
}
