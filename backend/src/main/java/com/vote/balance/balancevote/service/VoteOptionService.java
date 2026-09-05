package com.vote.balance.balancevote.service;

import com.vote.balance.balancevote.domain.VoteOption;
import com.vote.balance.balancevote.domain.VoteSession;
import com.vote.balance.balancevote.domain.VoteStatus;
import com.vote.balance.balancevote.dto.VoteOptionRequest;
import com.vote.balance.balancevote.dto.VoteOptionResponse;
import com.vote.balance.balancevote.repository.VoteOptionRepository;
import com.vote.balance.balancevote.repository.VoteSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class VoteOptionService {

    private final VoteSessionRepository voteSessionRepository;
    private final VoteOptionRepository voteOptionRepository;

    /**
     * 특정 세션의 선택지를 생성된 순서대로 조회한다.
     */
    public List<VoteOptionResponse> findAll(Integer year) {
        VoteSession session = findSession(year);

        return voteOptionRepository
                .findBySessionIdOrderByIdAsc(session.getId())
                .stream()
                .map(VoteOptionResponse::from)
                .toList();
    }

    /**
     * 선택지 추가
     */
    @Transactional
    public VoteOptionResponse create(
            Integer year,
            VoteOptionRequest request
    ) {
        VoteSession session = findSession(year);

        validateEditable(session);

        String label = request.label().trim();

        if (voteOptionRepository.existsBySessionIdAndLabel(session.getId(), label)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "이미 동일한 선택지가 있습니다."
            );
        }

        VoteOption option = VoteOption.builder()
                .session(session)
                .label(label)
                .build();

        VoteOption savedOption = voteOptionRepository.save(option);

        return VoteOptionResponse.from(savedOption);
    }

    /**
     * 선택지 수정
     *
     * label만 변경하고 id는 유지한다.
     * 따라서 생성 순서(id 기준)가 절대로 변경되지 않는다.
     */
    @Transactional
    public VoteOptionResponse update(
            Integer year,
            Long optionId,
            VoteOptionRequest request
    ) {
        VoteSession session = findSession(year);

        validateEditable(session);

        VoteOption option = findOption(optionId);

        validateOptionBelongsToSession(option, session);

        String label = request.label().trim();

        if (voteOptionRepository.existsDuplicateLabel(
                session.getId(),
                label,
                optionId
        )) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "이미 동일한 선택지가 있습니다."
            );
        }

        option.update(label);

        return VoteOptionResponse.from(option);
    }

    /**
     * 선택지 삭제
     */
    @Transactional
    public void delete(
            Integer year,
            Long optionId
    ) {
        VoteSession session = findSession(year);

        validateEditable(session);

        VoteOption option = findOption(optionId);

        validateOptionBelongsToSession(option, session);

        voteOptionRepository.delete(option);
    }

    /**
     * 선택지 변경은 WAITING 상태에서만 허용한다.
     *
     * 투표가 진행되거나 마감된 뒤에 선택지를 수정/삭제하면
     * 이미 집계된 득표의 의미가 바뀌어 결과를 신뢰할 수 없게 된다.
     * 수정이 필요하면 세션을 초기화(reset)한 뒤 변경해야 한다.
     */
    private void validateEditable(VoteSession session) {
        if (session.getStatus() != VoteStatus.WAITING) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "진행 중이거나 마감된 세션의 선택지는 변경할 수 없습니다. "
                            + "세션을 초기화한 뒤 수정해 주세요."
            );
        }
    }

    private VoteSession findSession(Integer year) {
        return voteSessionRepository.findByYear(year)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        year + "년 세션을 찾을 수 없습니다."
                ));
    }

    private VoteOption findOption(Long optionId) {
        return voteOptionRepository.findById(optionId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "선택지를 찾을 수 없습니다."
                ));
    }

    private void validateOptionBelongsToSession(
            VoteOption option,
            VoteSession session
    ) {
        if (!option.getSession().getId().equals(session.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "해당 세션의 선택지를 찾을 수 없습니다."
            );
        }
    }
}
