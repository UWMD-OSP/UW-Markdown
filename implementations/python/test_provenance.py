"""Nonportable source grammar, specificity, variant and history policy controls."""
import json
import unittest
from uwmd_reader import parse
from uwmd_provenance import verify_provenance,actor_class,ProvenancePolicyUnavailable

class ProvenanceTests(unittest.TestCase):
    def document(self,source,revision=1,variant='base',prior=False):
        meta=dict(provenance=dict(source=source,actor='agent/initiator'),lifecycle=dict(revision=revision,superseded=False))
        body={'_meta':meta}
        text='---\nuw_version: "3.0"\n---\n'
        if prior:text+='```json uw:section=valuation variant='+variant+' superseded=true\n'+json.dumps(body)+'\n```\n'
        text+='```json uw:section=valuation variant='+variant+'\n'+json.dumps(body)+'\n```\n'
        return parse(text.encode())
    def test_closed_source_namespace_cannot_be_repaired_by_a_principal(self):
        for source in ('agent:old','agent/','document/evidence','AGENT/a','plain','manual '):self.assertEqual(actor_class(source),'unknown')
        self.assertEqual(actor_class('manual'),'human');self.assertEqual(actor_class('agent/A.1'),'agent')
        doc=self.document('agent:old')
        result=verify_provenance(doc,[dict(source_pattern='*',authority='agent_only',supersede_on_edit=True)])
        self.assertEqual([i['code'] for i in result['issues']],['POL-01'])
    def test_supersede_heuristic_has_exact_variant_identity(self):
        doc=self.document('agent/example',revision=2)
        before=doc.source.raw
        self.assertEqual([i['code'] for i in verify_provenance(doc)['issues']],['POL-02'])
        self.assertTrue(verify_provenance(self.document('agent/example',revision=2,prior=True))['ok'])
        self.assertEqual(doc.source.raw,before)
    def test_specificity_and_incomplete_caller_policy(self):
        doc=self.document('agent/exact')
        policies=[dict(source_pattern='*',authority='system_only',supersede_on_edit=True),dict(source_pattern='agent/exact',authority='agent_only',supersede_on_edit=True)]
        self.assertTrue(verify_provenance(doc,policies)['ok'])
        with self.assertRaises(ProvenancePolicyUnavailable):verify_provenance(doc,[])
