import { MOCK_VOYAGES } from '@/mocks/voyages'
import { MOCK_VESSELS } from '@/mocks/vessels'
import { MOCK_POSITIONS } from '@/mocks/positions'
import { MOCK_OTHER_VOYAGES, MOCK_OTHER_VESSELS, MOCK_OTHER_POSITIONS } from '@/mocks/otherFleet'

// 자사 + 타사(배경 트래픽) 통합 조회용. id 네임스페이스가 겹치지 않는다
// (자사: voyNNN/vNNN, 타사: ovoyN/ovN)이므로 하나의 배열로 합쳐 조회해도 안전하다.
export const ALL_VOYAGES = [...MOCK_VOYAGES, ...MOCK_OTHER_VOYAGES]
export const ALL_VESSELS = [...MOCK_VESSELS, ...MOCK_OTHER_VESSELS]
export const ALL_POSITIONS = [...MOCK_POSITIONS, ...MOCK_OTHER_POSITIONS]
