package org.gotson.komga.infrastructure.sidecar

import org.apache.commons.io.FilenameUtils
import org.gotson.komga.domain.model.Sidecar
import org.springframework.stereotype.Service

/**
 * Matches cast-list sidecars next to a book file: `<book basename>.cast.json`
 * (the voice cast of a prebuilt multi-voice audiobook: narrator + characters
 * and the voice each one uses). Matching files are stored in the sidecar
 * table during scans, which is the index the book DTO's `cast` flag and the
 * cast REST endpoint are derived from.
 */
@Service
class CastSidecarConsumer : SidecarBookConsumer {
  override fun getSidecarBookType(): Sidecar.Type = Sidecar.Type.CAST

  override fun getSidecarBookPrefilter(): List<Regex> =
    listOf(
      ".*\\.cast\\.json".toRegex(RegexOption.IGNORE_CASE),
    )

  override fun isSidecarBookMatch(
    basename: String,
    sidecar: String,
  ): Boolean = FilenameUtils.getBaseName(sidecar).equals("$basename.cast", ignoreCase = true)
}
