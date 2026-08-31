package com.vote.balance.balancevote.service;

import com.vote.balance.balancevote.domain.VoteOption;
import com.vote.balance.balancevote.domain.VoteSession;
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

    public List<VoteOptionResponse> findAll(Integer year) {
        VoteSession session = findSession(year);

        return voteOptionRepository.findBySessionId(session.getId())
                .stream()
                .map(VoteOptionResponse::from)
                .toList();
    }

    @Transactional
    public VoteOptionResponse create(
            Integer year,
            VoteOptionRequest request
    ) {
        VoteSession session = findSession(year);

        validateRequest(request);

        VoteOption option = VoteOption.builder()
                .session(session)
                .label(request.label().trim())
                .build();

        VoteOption savedOption = voteOptionRepository.save(option);

        return VoteOptionResponse.from(savedOption);
    }

    @Transactional
    public VoteOptionResponse update(
            Integer year,
            Long optionId,
            VoteOptionRequest request
    ) {
        VoteSession session = findSession(year);

        validateRequest(request);

        VoteOption option = findOption(optionId);

        validateOptionBelongsToSession(option, session);

        option.update(request.label().trim());

        return VoteOptionResponse.from(option);
    }

    @Transactional
    public void delete(
            Integer year,
            Long optionId
    ) {
        VoteSession session = findSession(year);

        VoteOption option = findOption(optionId);

        validateOptionBelongsToSession(option, session);

        voteOptionRepository.delete(option);
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

    private void validateRequest(VoteOptionRequest request) {
        if (request == null
                || request.label() == null
                || request.label().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "선택지 내용은 비어 있을 수 없습니다."
            );
        }
    }
}