import ws from 'k6/ws'
import { check } from 'k6'
import { Counter, Rate, Trend } from 'k6/metrics'

var WS_URL = 'ws://localhost:8080/ws'
var YEAR = 2030

// STOMP 연결 성공 여부
var stompSuccessRate = new Rate('stomp_success_rate')

// 실제 WebSocket/STOMP 오류
var stompErrors = new Counter('stomp_errors')

// STOMP CONNECT까지 걸린 시간
var stompConnectTime = new Trend('stomp_connect_time')

export var options = {
  stages: [
    { duration: '30s', target: 200 },
    { duration: '30s', target: 400 },
    { duration: '30s', target: 600 },
    { duration: '30s', target: 800 },
    { duration: '2m', target: 800 },
    { duration: '30s', target: 0 }
  ],

  thresholds: {
    // STOMP CONNECT 성공률
    stomp_success_rate: ['rate>0.99'],

    // STOMP CONNECT 응답 시간
    stomp_connect_time: ['p(95)<500'],

    // 실제 오류
    stomp_errors: ['count<10'],

    // 기존 k6 WebSocket 세션 유지 시간
    ws_session_duration: ['p(95)>10000']
  }
}

export default function () {
  var startTime = Date.now()

  var connected = false
  var finished = false

  var response = ws.connect(WS_URL, {}, function (socket) {

    /*
     * WebSocket 연결 성공
     */
    socket.on('open', function () {

      /*
       * Spring STOMP CONNECT
       */
      socket.send(
        'CONNECT\n' +
        'accept-version:1.2\n' +
        'heart-beat:0,0\n' +
        '\n' +
        '\x00'
      )
    })

    /*
     * 서버에서 STOMP 메시지 수신
     */
    socket.on('message', function (message) {

      /*
       * STOMP CONNECTED
       */
      if (message.indexOf('CONNECTED') === 0) {

        connected = true

        stompConnectTime.add(Date.now() - startTime)
        stompSuccessRate.add(true)

        /*
         * 투표 결과 topic 구독
         */
        socket.send(
          'SUBSCRIBE\n' +
          'id:sub-' + __VU + '\n' +
          'destination:/topic/vote/' + YEAR + '\n' +
          'ack:auto\n' +
          '\n' +
          '\x00'
        )

        /*
         * 연결을 2분간 유지
         */
        socket.setTimeout(function () {

          if (finished) {
            return
          }

          finished = true

          /*
           * 구독 해제
           */
          socket.send(
            'UNSUBSCRIBE\n' +
            'id:sub-' + __VU +
            '\n' +
            '\n' +
            '\x00'
          )

          /*
           * STOMP 정상 종료
           */
          socket.send(
            'DISCONNECT\n' +
            '\n' +
            '\x00'
          )

          socket.close()

        }, 120000)
      }

      /*
       * 실제 투표 결과 메시지 수신
       */
      if (message.indexOf('MESSAGE') === 0) {

        check(message, {
          'STOMP vote message received': function (msg) {
            return msg.indexOf(
              'destination:/topic/vote/' + YEAR
            ) !== -1
          }
        })
      }
    })

    /*
     * WebSocket 에러
     *
     * 정상 종료는 여기서 오류로 처리하지 않음
     */
    socket.on('error', function (error) {

      if (!finished) {
        stompErrors.add(1)

        console.log(
          'VU ' + __VU +
          ' WebSocket error: ' +
          error
        )
      }
    })

    /*
     * WebSocket 종료
     */
    socket.on('close', function () {

      /*
       * CONNECT 전에 끊겼다면 실패
       */
      if (!connected && !finished) {
        stompErrors.add(1)
        stompSuccessRate.add(false)

        console.log(
          'VU ' + __VU +
          ' STOMP 연결 실패'
        )
      }
    })
  })

  /*
   * WebSocket HTTP Upgrade 확인
   */
  check(response, {
    'WebSocket status is 101': function (r) {
      return r && r.status === 101
    }
  })

  /*
   * WebSocket 자체 연결 실패
   */
  if (!response || response.status !== 101) {
    stompErrors.add(1)
    stompSuccessRate.add(false)
  }
}