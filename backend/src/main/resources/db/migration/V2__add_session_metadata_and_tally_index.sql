/*
 * 1. 세션에 문제(질문) 텍스트와 오픈/마감 시각을 추가한다.
 *
 *    - question: 밸런스 게임 문제 문구. 결과 화면과 CSV 출력의 헤더로 사용한다.
 *    - opened_at / closed_at: 연도별 투표의 실제 진행 시각.
 *      진행 후 세션별 결과를 출력할 때 필요하다.
 */
ALTER TABLE vote_session ADD COLUMN question VARCHAR(500);
ALTER TABLE vote_session ADD COLUMN opened_at TIMESTAMP;
ALTER TABLE vote_session ADD COLUMN closed_at TIMESTAMP;

/*
 * 2. 투표 기록이 있는 선택지를 삭제할 때 FK 위반으로 500이 발생하던 문제를 해결한다.
 *
 *    기존 fk_vote_record_option 에는 ON DELETE CASCADE 가 없어
 *    득표가 있는 선택지 삭제가 DataIntegrityViolationException 으로 이어졌다.
 *
 *    애플리케이션에서는 WAITING 상태에서만 선택지 삭제를 허용하므로
 *    실제로 기록이 함께 삭제되는 경우는 초기화 이후뿐이며,
 *    CASCADE 는 최후의 정합성 보장 장치로 둔다.
 */
ALTER TABLE vote_record DROP CONSTRAINT fk_vote_record_option;

ALTER TABLE vote_record ADD CONSTRAINT fk_vote_record_option
    FOREIGN KEY (option_id)
    REFERENCES vote_option (id)
    ON DELETE CASCADE;

/*
 * 3. 집계 쿼리용 인덱스.
 *
 *    득표 집계는 session_id 로 필터 후 option_id 로 GROUP BY 하므로
 *    복합 인덱스로 커버한다. 중복 투표 확인(session_id, voter_token)은
 *    기존 uk_vote_record_session_voter UNIQUE 제약이 이미 커버한다.
 */
CREATE INDEX ix_vote_record_session_option
    ON vote_record (session_id, option_id);

CREATE INDEX ix_vote_option_session
    ON vote_option (session_id);
