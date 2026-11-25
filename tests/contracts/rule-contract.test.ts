import { createTestRuleContext, createTestRuleDef } from '../helpers';
import { runRuleContract } from './rule-contract';

runRuleContract(createTestRuleDef({ id: 'contract-sample-rule', defaultLimit: 5 }), {
  validSubject: 3,
  violatingSubject: 9,
  context: createTestRuleContext({ worldTick: 1 }),
});
