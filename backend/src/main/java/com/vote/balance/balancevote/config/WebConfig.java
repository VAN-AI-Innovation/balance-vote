package com.vote.balance.balancevote.config;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Arrays;

@Configuration
@RequiredArgsConstructor
public class WebConfig implements WebMvcConfigurer {

    private final AdminAuthInterceptor adminAuthInterceptor;

    /**
     * 허용 오리진을 설정으로 분리한다.
     *
     * 기존에는 http://localhost:5173 만 하드코딩되어 있어
     * Vercel 로 배포하면 모든 API 호출이 CORS 에서 막혔다.
     *
     * allowedOriginPatterns 를 사용하므로
     * https://*.vercel.app 같은 와일드카드로 preview 배포까지 커버된다.
     */
    @Value("${app.cors.allowed-origins:http://localhost:5173}")
    private String allowedOrigins;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns(parseOrigins())
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                /*
                 * CSV 다운로드 시 브라우저가 파일명을 읽을 수 있어야 한다.
                 */
                .exposedHeaders("Content-Disposition")
                .maxAge(3600);
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(adminAuthInterceptor)
                .addPathPatterns("/api/**");
    }

    private String[] parseOrigins() {
        return Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .toArray(String[]::new);
    }
}
