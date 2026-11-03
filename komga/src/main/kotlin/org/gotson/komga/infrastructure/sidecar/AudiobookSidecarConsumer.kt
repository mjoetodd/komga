package org.gotson.komga.infrastructure.sidecar

import org.apache.commons.io.FilenameUtils
import org.gotson.komga.domain.model.Sidecar
import org.springframework.stereotype.Service

/**
 * Matches prebuilt-audiobook sidecars next to a book file:
 * `<book basename>.audio.mp3` (the narration) and `<book basename>.audio.json`
 * (the sync map). Matching files are stored in the sidecar table during scans,
 * which is the index the book DTO's `audiobook` flag and the audiobook REST
 * endpoints are derived from. The audio bytes themselves never enter the DB.
 */
@Service
class AudiobookSidecarConsumer : SidecarBookConsumer {
  override fun getSidecarBookType(): Sidecar.Type = Sidecar.Type.AUDIO

  override fun getSidecarBookPrefilter(): List<Regex> =
    listOf(
      ".*\\.audio\\.mp3".toRegex(RegexOption.IGNORE_CASE),
      ".*\\.audio\\.json".toRegex(RegexOption.IGNORE_CASE),
    )

  override fun isSidecarBookMatch(
    basename: String,
    sidecar: String,
  ): Boolean = FilenameUtils.getBaseName(sidecar).equals("$basename.audio", ignoreCase = true)
}
