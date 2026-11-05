package org.gotson.komga.interfaces.mvc

import jakarta.servlet.ServletContext
import jakarta.servlet.http.HttpServletRequest
import org.gotson.komga.infrastructure.configuration.KomgaSettingsProvider
import org.springframework.stereotype.Controller
import org.springframework.ui.Model
import org.springframework.web.bind.annotation.GetMapping

@Controller
class IndexController(
  servletContext: ServletContext,
  val komgaSettingsProvider: KomgaSettingsProvider,
) {
  private val baseUrl: String = "${servletContext.contextPath}/"

  @GetMapping("/")
  fun index(
    model: Model,
  ): String {
    model.addAttribute("baseUrl", baseUrl)

    return if (komgaSettingsProvider.nextUiAsDefault) "index-next" else "index"
  }

  @GetMapping(value = ["/classic", "/classic/**"])
  fun indexClassic(model: Model): String {
    model.addAttribute("baseUrl", baseUrl)
    return "index"
  }

  @GetMapping(value = ["/next", "/next/**"])
  fun indexNext(model: Model): String {
    model.addAttribute("baseUrl", baseUrl)
    return "index-next"
  }

  // The audiobook player lives only in the next UI, under the unprefixed
  // route /listen/{bookId}. A fresh load of that path must be served the
  // next UI shell (the classic shell has no such route and 404s), and the
  // classic UI's Listen button deep-links to /next/listen/{bookId}, which
  // the next UI's router (base '/') cannot match - redirect it to the
  // canonical unprefixed URL, which this mapping then serves.
  @GetMapping(value = ["/listen", "/listen/**"])
  fun indexListen(model: Model): String {
    model.addAttribute("baseUrl", baseUrl)
    return "index-next"
  }

  @GetMapping("/next/listen/**")
  fun nextListenRedirect(request: HttpServletRequest): String {
    val rest = request.requestURI.removePrefix("${request.contextPath}/next")
    val qs = request.queryString
    return "redirect:$rest" + if (qs != null) "?$qs" else ""
  }
}
