package org.gotson.komga.interfaces.api.rest

import io.github.oshai.kotlinlogging.KotlinLogging
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import org.gotson.komga.infrastructure.configuration.KomgaSettingsProvider
import org.gotson.komga.infrastructure.openapi.OpenApiConfiguration
import org.gotson.komga.infrastructure.security.KomgaPrincipal
import org.springframework.boot.http.client.ClientHttpRequestFactoryBuilder
import org.springframework.boot.http.client.ClientHttpRequestFactorySettings
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.HttpStatusCode
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.client.RestClient
import org.springframework.web.client.toEntity
import org.springframework.web.server.ResponseStatusException
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds
import kotlin.time.toJavaDuration

private val logger = KotlinLogging.logger {}

data class TtsSpeakRequestDto(
  val input: String,
  val voice: String? = null,
  val rate: Double? = null,
  val language: String? = null,
)

data class TtsStatusDto(
  val configured: Boolean,
)

@RestController
@RequestMapping(value = ["api/v1/tts"], produces = [MediaType.ALL_VALUE])
@Tag(name = OpenApiConfiguration.TagNames.TTS)
class TtsController(
  private val komgaSettingsProvider: KomgaSettingsProvider,
) {
  private val client: RestClient =
    RestClient
      .builder()
      .requestFactory(
        ClientHttpRequestFactoryBuilder.reactor().build(
          ClientHttpRequestFactorySettings
            .defaults()
            // self-hosted models (often a single GPU-bound worker behind a lock) can take a
            // while to generate a sentence, especially if a few requests queue up - prefer
            // waiting over spuriously failing a request that's still legitimately in progress
            .withReadTimeout(2.minutes.toJavaDuration())
            .withConnectTimeout(10.seconds.toJavaDuration()),
        ),
      ).build()

  private fun baseUrl(): String =
    komgaSettingsProvider.ttsProviderUrl
      ?.takeIf { it.isNotBlank() }
      ?.trimEnd('/')
      ?: throw ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "No TTS provider is configured on the server")

  private fun proxyGet(path: String): ResponseEntity<ByteArray> {
    val url = "${baseUrl()}$path"
    val apiKey = komgaSettingsProvider.ttsProviderApiKey

    val response =
      try {
        client
          .get()
          .uri(url)
          .headers { headers ->
            if (!apiKey.isNullOrBlank()) headers.setBearerAuth(apiKey)
          }.retrieve()
          .onStatus(HttpStatusCode::isError) { _, res ->
            logger.warn { "TTS provider returned an error: ${res.statusCode}" }
            throw ResponseStatusException(HttpStatus.BAD_GATEWAY, "TTS provider returned an error: ${res.statusCode}")
          }.toEntity<ByteArray>()
      } catch (e: ResponseStatusException) {
        throw e
      } catch (e: Exception) {
        logger.warn(e) { "Could not reach TTS provider at $url" }
        throw ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not reach the configured TTS provider")
      }

    return ResponseEntity
      .status(response.statusCode)
      .headers(
        HttpHeaders().apply {
          response.headers[HttpHeaders.CONTENT_TYPE]?.firstOrNull()?.let { set(HttpHeaders.CONTENT_TYPE, it) }
        },
      ).body(response.body)
  }

  @GetMapping("status")
  @Operation(summary = "Get TTS provider status", description = "Lets any authenticated user check whether an admin has configured a server-side TTS provider, without exposing its URL or key.")
  fun status(
    @AuthenticationPrincipal principal: KomgaPrincipal,
  ): TtsStatusDto = TtsStatusDto(!komgaSettingsProvider.ttsProviderUrl.isNullOrBlank())

  @GetMapping("voices")
  @Operation(
    summary = "List available voices and languages",
    description = "Proxies to the server-configured provider's `/v1/voices` endpoint (OpenAI-compatible convention), so the browser never needs the provider's URL or key.",
  )
  fun voices(
    @AuthenticationPrincipal principal: KomgaPrincipal,
  ): ResponseEntity<ByteArray> = proxyGet("/v1/voices")

  @PostMapping("speak")
  @Operation(
    summary = "Synthesize speech",
    description = "Proxy a text-to-speech request to the server-configured provider's `/v1/audio/speech` endpoint (OpenAI-compatible convention), so the provider's API key is never exposed to the browser.",
  )
  fun speak(
    @AuthenticationPrincipal principal: KomgaPrincipal,
    @RequestBody request: TtsSpeakRequestDto,
  ): ResponseEntity<ByteArray> {
    val url = "${baseUrl()}/v1/audio/speech"
    val apiKey = komgaSettingsProvider.ttsProviderApiKey
    val voice = request.voice ?: komgaSettingsProvider.ttsDefaultVoice

    // omit null fields entirely: providers commonly validate request bodies strictly
    // (e.g. Pydantic) and reject an explicit `null` for a field typed as a plain string
    val body =
      buildMap {
        put("input", request.input)
        put("speed", request.rate ?: 1.0)
        if (!voice.isNullOrBlank()) put("voice", voice)
        if (!request.language.isNullOrBlank()) put("language", request.language)
      }

    val response =
      try {
        client
          .post()
          .uri(url)
          .headers { headers ->
            headers.contentType = MediaType.APPLICATION_JSON
            if (!apiKey.isNullOrBlank()) headers.setBearerAuth(apiKey)
          }.body(body)
          .retrieve()
          .onStatus(HttpStatusCode::isError) { _, res ->
            logger.warn { "TTS provider returned an error: ${res.statusCode}" }
            throw ResponseStatusException(HttpStatus.BAD_GATEWAY, "TTS provider returned an error: ${res.statusCode}")
          }.toEntity<ByteArray>()
      } catch (e: ResponseStatusException) {
        throw e
      } catch (e: Exception) {
        logger.warn(e) { "Could not reach TTS provider at $url" }
        throw ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not reach the configured TTS provider")
      }

    return ResponseEntity
      .status(response.statusCode)
      .headers(
        HttpHeaders().apply {
          response.headers[HttpHeaders.CONTENT_TYPE]?.firstOrNull()?.let { set(HttpHeaders.CONTENT_TYPE, it) }
        },
      ).body(response.body)
  }
}
