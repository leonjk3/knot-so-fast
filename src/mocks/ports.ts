export interface Port {
  code: string
  name: string
  nameEn: string
  lat: number
  lng: number
}

// 자사·타사 항차 목업에서 공통으로 참조하는 주요 항구 사전
export const PORTS: Port[] = [
  { code: 'PUS', name: '부산',       nameEn: 'Busan',          lat: 35.10,  lng: 129.04  },
  { code: 'ULS', name: '울산',       nameEn: 'Ulsan',          lat: 35.50,  lng: 129.30  },
  { code: 'GGY', name: '광양',       nameEn: 'Gwangyang',      lat: 34.90,  lng: 127.70  },
  { code: 'INC', name: '인천',       nameEn: 'Incheon',        lat: 37.45,  lng: 126.60  },
  { code: 'SHA', name: '상하이',     nameEn: 'Shanghai',       lat: 31.20,  lng: 121.50  },
  { code: 'HKG', name: '홍콩',       nameEn: 'Hong Kong',      lat: 22.30,  lng: 114.20  },
  { code: 'SIN', name: '싱가포르',   nameEn: 'Singapore',      lat: 1.30,   lng: 103.80  },
  { code: 'KHH', name: '가오슝',     nameEn: 'Kaohsiung',      lat: 22.60,  lng: 120.30  },
  { code: 'TYO', name: '도쿄',       nameEn: 'Tokyo',          lat: 35.60,  lng: 139.80  },
  { code: 'YOK', name: '요코하마',   nameEn: 'Yokohama',       lat: 35.45,  lng: 139.65  },
  { code: 'MNL', name: '마닐라',     nameEn: 'Manila',         lat: 14.60,  lng: 120.95  },
  { code: 'PHE', name: '포트헤들랜드', nameEn: 'Port Hedland', lat: -20.30, lng: 118.60  },
  { code: 'RTN', name: '라스 타누라', nameEn: 'Ras Tanura',    lat: 26.60,  lng: 50.20   },
  { code: 'DXB', name: '두바이',     nameEn: 'Dubai',          lat: 25.00,  lng: 55.06   },
  { code: 'RTM', name: '로테르담',   nameEn: 'Rotterdam',      lat: 51.90,  lng: 4.50    },
  { code: 'ANT', name: '앤트워프',   nameEn: 'Antwerp',        lat: 51.26,  lng: 4.40    },
  { code: 'HAM', name: '함부르크',   nameEn: 'Hamburg',        lat: 53.50,  lng: 9.90    },
  { code: 'FEL', name: '펠릭스토',   nameEn: 'Felixstowe',     lat: 51.96,  lng: 1.35    },
  { code: 'PIR', name: '피레우스',   nameEn: 'Piraeus',        lat: 37.94,  lng: 23.63   },
  { code: 'BCN', name: '바르셀로나', nameEn: 'Barcelona',      lat: 41.35,  lng: 2.17    },
  { code: 'LAX', name: '로스앤젤레스', nameEn: 'Los Angeles',  lat: 33.70,  lng: -118.20 },
  { code: 'LGB', name: '롱비치',     nameEn: 'Long Beach',     lat: 33.75,  lng: -118.19 },
  { code: 'OAK', name: '오클랜드(미)', nameEn: 'Oakland',      lat: 37.80,  lng: -122.30 },
  { code: 'SEA', name: '시애틀',     nameEn: 'Seattle',        lat: 47.60,  lng: -122.34 },
  { code: 'VAN', name: '밴쿠버',     nameEn: 'Vancouver',      lat: 49.29,  lng: -123.11 },
  { code: 'NYC', name: '뉴욕',       nameEn: 'New York',       lat: 40.70,  lng: -74.00  },
  { code: 'SAV', name: '서배너',     nameEn: 'Savannah',       lat: 32.08,  lng: -81.09  },
  { code: 'AKL', name: '오클랜드',   nameEn: 'Auckland',       lat: -36.80, lng: 174.80  },
  { code: 'SYD', name: '시드니',     nameEn: 'Sydney',         lat: -33.85, lng: 151.21  },
  { code: 'MEL', name: '멜버른',     nameEn: 'Melbourne',      lat: -37.84, lng: 144.93  },
]

export function findPort(code: string): Port | undefined {
  return PORTS.find(p => p.code === code)
}

export function formatPortLabel(port: Port): string {
  return `${port.name} (${port.nameEn})`
}

// "부산 (Busan)" 형태의 표시 문자열에서 코드를 역으로 찾는다. 못 찾으면 undefined —
// 호출부가 항구명 첫 토큰으로 폴백한다(DASHBOARD.md 6.3장).
export function getPortCode(label: string): string | undefined {
  return PORTS.find((p) => formatPortLabel(p) === label)?.code
}
