from pathlib import Path
import unittest
S=(Path(__file__).parent/'CEBONK_WEEKLY_SWEEP_RECLAIM_v3.03.mq5').read_text(encoding='utf-8')
class SourceContracts(unittest.TestCase):
 def test_reclaim_entry(self):
  b=S[S.index('void ProcessClosedBar('):S.index('void DisplayStatus()')]
  self.assertIn('DetectSweep(bar,previous,s)',b)
  self.assertIn('ExecuteSetup(s,now)',b)
  self.assertIn('!EntryWindow(close_time) || !EntryWindow(now)',b)
 def test_no_ib_cb1_as_entry(self):
  self.assertNotIn('AutomaticIB(',S)
  self.assertNotIn('EarlierCB1(',S)
  self.assertNotIn('InpIBSource',S)
  self.assertNotIn('InpM5Structure',S)
 def test_sweep_and_reclaim(self):
  b=S[S.index('bool DetectSweep('):S.index('bool IsOwnPosition()')]
  self.assertIn('CB22_Breach(',b)
  self.assertIn('CB22_Reclaim(',b)
  self.assertIn('gFrozenLevels',b)
 def test_window_safe_retry(self):
  b=S[S.index('void TryPendingReclaim('):S.index('void ProcessClosedBar(')]
  self.assertIn('current!=gPending.bar_open',b)
  self.assertIn('!EntryWindow(now)',b)
 def test_risk_preserved(self):
  self.assertIn('CB22_Risk(setup.direction,entry,setup.extreme',S)
  self.assertIn('CB22_MAX_SPREAD 70.0',S)
  self.assertIn('InpLotMode=LOT_FIXED',S)
  self.assertIn('InpEnableTrading=false',S)
if __name__=='__main__': unittest.main()
