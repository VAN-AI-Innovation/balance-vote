CREATE TABLE vote_session (
    id BIGSERIAL PRIMARY KEY,
    year INTEGER NOT NULL UNIQUE,
    status VARCHAR(255) NOT NULL,
    current BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL
);

CREATE TABLE vote_option (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL,
    label VARCHAR(255) NOT NULL,
    CONSTRAINT fk_vote_option_session
        FOREIGN KEY (session_id)
        REFERENCES vote_session (id)
        ON DELETE CASCADE
);

CREATE TABLE vote_record (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL,
    option_id BIGINT NOT NULL,
    voter_token VARCHAR(255) NOT NULL,
    voted_at TIMESTAMP NOT NULL,
    CONSTRAINT fk_vote_record_session
        FOREIGN KEY (session_id)
        REFERENCES vote_session (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_vote_record_option
        FOREIGN KEY (option_id)
        REFERENCES vote_option (id),
    CONSTRAINT uk_vote_record_session_voter
        UNIQUE (session_id, voter_token)
);

CREATE UNIQUE INDEX ux_vote_session_current
    ON vote_session (current)
    WHERE current = TRUE;