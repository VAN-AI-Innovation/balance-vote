# Railway / Render / Fly.io 등 Dockerfile 기반 호스팅용.
#
# 1단계: gradle wrapper로 빌드 (테스트는 배포 파이프라인에서 반복 실행할
#        필요가 없으므로 -x test 로 건너뛴다. CI에서 별도로 돌린다는 전제)
# 2단계: 빌드 산출물(jar)만 담은 가벼운 런타임 이미지로 복사한다.
FROM eclipse-temurin:21-jdk AS build
WORKDIR /workspace

COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle
RUN ./gradlew --version

COPY src ./src
RUN ./gradlew clean bootJar -x test --no-daemon

FROM eclipse-temurin:21-jre
WORKDIR /app

COPY --from=build /workspace/build/libs/*.jar app.jar

# Railway/Render는 PORT 환경변수를 주입한다.
# application.properties의 server.port=${PORT:8080} 가 이를 읽는다.
EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
