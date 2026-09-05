package com.vote.balance.balancevote.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;

import java.util.Arrays;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    /**
     * 하트비트 주기(ms). 클라이언트도 10초로 설정되어 있다.
     */
    private static final long[] HEARTBEAT = {10_000L, 10_000L};

    @Value("${app.websocket.allowed-origins:*}")
    private String allowedOrigins;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic")
                /*
                 * 하트비트를 켜면 끊어진 연결을 양쪽에서 빠르게 감지한다.
                 * SimpleBroker 의 하트비트는 TaskScheduler 가 있어야 동작한다.
                 */
                .setHeartbeatValue(HEARTBEAT)
                .setTaskScheduler(heartbeatScheduler());

        registry.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(parseOrigins());
    }

    /**
     * 관객 수백 명이 동시에 접속하는 상황을 고려한 전송 설정.
     *
     * 결과 프레임은 작지만, 느린 모바일 회선 때문에 송신 버퍼가 차면
     * 브로커 스레드가 막히므로 버퍼와 전송 제한을 명시한다.
     */
    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
        registration.setMessageSizeLimit(64 * 1024)
                .setSendBufferSizeLimit(512 * 1024)
                .setSendTimeLimit(20 * 1000);
    }

    private ThreadPoolTaskScheduler heartbeatScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(1);
        scheduler.setThreadNamePrefix("ws-heartbeat-");
        scheduler.initialize();

        return scheduler;
    }

    private String[] parseOrigins() {
        return Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .toArray(String[]::new);
    }
}
