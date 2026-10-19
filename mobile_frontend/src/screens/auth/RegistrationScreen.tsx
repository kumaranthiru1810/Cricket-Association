import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Modal
} from 'react-native';
import { useAppNavigation } from '../../navigation/AppNavigator';
import SharedBackground from '../../components/scorer/SharedBackground';
import { ScorerApi } from '../../services/api';

export type RegistrationRole = 'PLAYER' | 'TEAM' | 'SCORER' | 'UMPIRE';

export interface SquadPlayer {
  id: string;
  name: string;
  email: string;
  role: string;
}

const COMMON_ROLES = [
  'Captain',
  'Vice Captain',
  'Wicket Keeper',
  'Batter',
  'Bowler',
  'All-Rounder'
];

const PLAYER_ROLES = ['Batter', 'Bowler', 'All-Rounder', 'Wicket Keeper'];
const AGE_CATEGORIES = ['Senior Men', "Women's Senior", 'Under-23', 'Under-19', 'Under-16', 'Under-14'];
const BATTING_STYLES = ['Right Hand Bat', 'Left Hand Bat'];
const BOWLING_STYLES = ['Right Arm Fast/Medium', 'Right Arm Spin', 'Left Arm Orthodox', 'Left Arm Fast'];
const TALUKS = ['Virudhunagar', 'Sivakasi', 'Rajapalayam', 'Srivilliputhur', 'Aruppukottai', 'Sattur', 'Watrap'];
const TALUK_OPTIONS = [...TALUKS, 'Other'];
const SCORER_LEVELS = ['District Certified', 'State Panel', 'Club Scorer', 'Trainee Scorer'];

const UMPIRE_QUALIFICATIONS = [
  'State Panel A (Senior)',
  'State Panel B',
  'BCCI Level 1 Certified',
  'District Senior Panel',
  'District Certified Umpire',
  'Trainee Umpire'
];
const GENDERS = ['Male', 'Female', 'Other'];
const UMPIRE_SPECIALIZATIONS = [
  'On-field Umpire',
  'Third / TV Umpire',
  'Reserve Umpire',
  'Match Referee & Official'
];
const DISTRICT_OPTIONS = [
  'Virudhunagar',
  'Madurai',
  'Sivakasi',
  'Rajapalayam',
  'Srivilliputhur',
  'Aruppukottai',
  'Sattur',
  'Watrap',
  'Chennai',
  'Coimbatore',
  'Tirunelveli',
  'Other'
];
const STATE_OPTIONS = ['Tamil Nadu', 'Kerala', 'Karnataka', 'Andhra Pradesh', 'Other'];

const SAMPLE_15_SQUAD: Array<{ name: string; email: string; role: string }> = [
  { name: 'R. Saravanan', email: 'saravanan.r@strikerscc.org', role: 'Captain' },
  { name: 'S. Karthik', email: 'karthik.s@strikerscc.org', role: 'Vice Captain' },
  { name: 'K. Murugan', email: 'murugan.k@strikerscc.org', role: 'Wicket Keeper' },
  { name: 'V. Vignesh', email: 'vignesh.v@strikerscc.org', role: 'Bowler' },
  { name: 'M. Ashwin Kumar', email: 'ashwin.k@strikerscc.org', role: 'All-Rounder' },
  { name: 'P. Vijay Anand', email: 'vijay.a@strikerscc.org', role: 'Batter' },
  { name: 'B. Dinesh Babu', email: 'dinesh.b@strikerscc.org', role: 'Batter' },
  { name: 'T. Praveen Raj', email: 'praveen.r@strikerscc.org', role: 'Bowler' },
  { name: 'A. Suresh Kumar', email: 'suresh.k@strikerscc.org', role: 'Bowler' },
  { name: 'N. Bala Murugan', email: 'bala.m@strikerscc.org', role: 'Bowler' },
  { name: 'G. Arun Pandian', email: 'arun.p@strikerscc.org', role: 'Batter' },
  { name: 'C. Manikandan', email: 'manikandan.c@strikerscc.org', role: 'All-Rounder' },
  { name: 'E. Gokul Nath', email: 'gokul.n@strikerscc.org', role: 'Bowler' },
  { name: 'L. Selva Ganesh', email: 'selva.g@strikerscc.org', role: 'Batter' },
  { name: 'D. Rajesh', email: 'rajesh.d@strikerscc.org', role: 'Wicket Keeper' }
];

interface RegistrationScreenProps {
  onExit?: () => void;
}

export default function RegistrationScreen({ onExit }: RegistrationScreenProps = {}) {
  const { navigate, goBack, params } = useAppNavigation();

  const getInitialRole = (): RegistrationRole => {
    const r = (params?.initialRole as string)?.toUpperCase();
    if (r === 'PLAYER') return 'PLAYER';
    if (r === 'TEAM' || r === 'COACH') return 'TEAM';
    if (r === 'SCORER') return 'SCORER';
    if (r === 'UMPIRE') return 'UMPIRE';
    return 'PLAYER';
  };

  const [activeRole, setActiveRole] = useState<RegistrationRole>(getInitialRole());

  // Global loading and status
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSendingOtp, setIsSendingOtp] = useState<boolean>(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'info' | 'success' | 'error' | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});

  const clearError = (field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  // OTP & Password State
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [otpCode, setOtpCode] = useState<string>('');
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // 1. PLAYER REGISTRATION STATE
  const [pName, setPName] = useState<string>('');
  const [pEmail, setPEmail] = useState<string>('');
  const [pMobile, setPMobile] = useState<string>('');
  const [pRole, setPRole] = useState<string>('Batter');
  const [pCategory, setPCategory] = useState<string>('Senior Men');
  const [pTaluk, setPTaluk] = useState<string>('Virudhunagar');
  const [pCustomTaluk, setPCustomTaluk] = useState<string>('');
  const [pBattingStyle, setPBattingStyle] = useState<string>('Right Hand Bat');
  const [pBowlingStyle, setPBowlingStyle] = useState<string>('Right Arm Fast/Medium');
  const [pClub, setPClub] = useState<string>('');
  const [pAgreed, setPAgreed] = useState<boolean>(true);

  // 2. TEAM REGISTRATION STATE
  const [teamName, setTeamName] = useState<string>('');
  const [coachName, setCoachName] = useState<string>('');
  const [coachEmail, setCoachEmail] = useState<string>('');
  const [teamTaluk, setTeamTaluk] = useState<string>('Virudhunagar');
  const [teamCustomTaluk, setTeamCustomTaluk] = useState<string>('');
  const [squadPlayerName, setSquadPlayerName] = useState<string>('');
  const [squadPlayerEmail, setSquadPlayerEmail] = useState<string>('');
  const [squadPlayerRole, setSquadPlayerRole] = useState<string>('Batter');
  const [players, setPlayers] = useState<SquadPlayer[]>([]);
  const [teamAgreed, setTeamAgreed] = useState<boolean>(true);

  // 3. SCORER REGISTRATION STATE
  const [sName, setSName] = useState<string>('');
  const [sEmail, setSEmail] = useState<string>('');
  const [sMobile, setSMobile] = useState<string>('');
  const [sTaluk, setSTaluk] = useState<string>('Virudhunagar');
  const [sCustomTaluk, setSCustomTaluk] = useState<string>('');
  const [sLevel, setSLevel] = useState<string>('District Certified');
  const [sAgreed, setSAgreed] = useState<boolean>(true);

  // 4. UMPIRE REGISTRATION STATE
  const [uName, setUName] = useState<string>('');
  const [uEmail, setUEmail] = useState<string>('');
  const [uMobile, setUMobile] = useState<string>('');
  const [uDob, setUDob] = useState<string>('');
  const [uGender, setUGender] = useState<string>('Male');
  const [uExperience, setUExperience] = useState<string>('');
  const [uYearsOfExperience, setUYearsOfExperience] = useState<string>('');
  const [uQualification, setUQualification] = useState<string>('District Certified Umpire');
  const [uAddress, setUAddress] = useState<string>('');
  const [uDistrict, setUDistrict] = useState<string>('Virudhunagar');
  const [uCustomDistrict, setUCustomDistrict] = useState<string>('');
  const [uState, setUState] = useState<string>('Tamil Nadu');
  const [uProfilePhoto, setUProfilePhoto] = useState<string>('');
  const [uCertNumber, setUCertNumber] = useState<string>('');
  const [uPrevOrg, setUPrevOrg] = useState<string>('');
  const [uSpecialization, setUSpecialization] = useState<string>('On-field Umpire');
  const [uAdditionalInfo, setUAdditionalInfo] = useState<string>('');
  const [uAgreed, setUAgreed] = useState<boolean>(true);
  const [showOptionalUmpireFields, setShowOptionalUmpireFields] = useState<boolean>(false);

  // Modal Dropdown State
  const [pickerState, setPickerState] = useState<{
    visible: boolean;
    title: string;
    options: string[];
    selectedValue: string;
    onSelect: (val: string) => void;
  } | null>(null);

  const validateEmail = (val: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  };

  const getTargetEmail = (): string => {
    if (activeRole === 'PLAYER') return pEmail.trim().toLowerCase();
    if (activeRole === 'TEAM') return coachEmail.trim().toLowerCase();
    if (activeRole === 'SCORER') return sEmail.trim().toLowerCase();
    return uEmail.trim().toLowerCase();
  };

  const getTargetName = (): string => {
    if (activeRole === 'PLAYER') return pName.trim();
    if (activeRole === 'TEAM') return coachName.trim();
    if (activeRole === 'SCORER') return sName.trim();
    return uName.trim();
  };

  const switchRole = (role: RegistrationRole) => {
    setActiveRole(role);
    setOtpSent(false);
    setOtpCode('');
    setIsEmailVerified(false);
    setPassword('');
    setConfirmPassword('');
    setStatusMessage(null);
    setStatusType(null);
    setFieldErrors({});
  };

  // Step 1: Send Email Verification OTP
  const handleSendEmailOtp = async () => {
    setStatusMessage(null);
    setStatusType(null);

    const email = getTargetEmail();
    const name = getTargetName();
    const newErrors: { [key: string]: string } = {};

    if (!name) {
      if (activeRole === 'PLAYER') newErrors.pName = 'Please enter Player Full Name first.';
      else if (activeRole === 'TEAM') newErrors.coachName = 'Please enter Coach / Manager Name first.';
      else if (activeRole === 'SCORER') newErrors.sName = 'Please enter Scorer Full Name first.';
      else newErrors.uName = 'Please enter Umpire Full Name first.';
    }
    if (!email || !validateEmail(email)) {
      if (activeRole === 'PLAYER') newErrors.pEmail = 'Please enter a valid Player Email address to receive OTP.';
      else if (activeRole === 'TEAM') newErrors.coachEmail = 'Please enter a valid Coach Email address to receive OTP.';
      else if (activeRole === 'SCORER') newErrors.sEmail = 'Please enter a valid Scorer Email address to receive OTP.';
      else newErrors.uEmail = 'Please enter a valid Umpire Email address to receive OTP.';
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...newErrors }));
      return;
    }

    setIsSendingOtp(true);
    setStatusMessage(`Sending verification code to ${email}...`);
    setStatusType('info');

    try {
      await ScorerApi.sendRegistrationOtp(email, name, activeRole);
      setOtpSent(true);
      clearError('emailVerification');
      setStatusMessage(`✓ Verification code sent to ${email} via Nodemailer! Please enter the 6-digit code.`);
      setStatusType('success');
    } catch (err: any) {
      const msg = err?.message || 'Failed to send OTP. Please check email address and try again.';
      const field =
        activeRole === 'PLAYER'
          ? 'pEmail'
          : activeRole === 'TEAM'
          ? 'coachEmail'
          : activeRole === 'SCORER'
          ? 'sEmail'
          : 'uEmail';
      setFieldErrors((prev) => ({ ...prev, [field]: msg }));
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Step 2: Verify Email OTP
  const handleVerifyEmailOtp = async () => {
    setStatusMessage(null);
    setStatusType(null);

    const email = getTargetEmail();
    const cleanOtp = otpCode.trim();

    if (!cleanOtp) {
      setFieldErrors((prev) => ({ ...prev, otpCode: 'Please enter the 6-digit OTP code.' }));
      return;
    }

    setIsVerifyingOtp(true);
    try {
      await ScorerApi.verifyRegistrationOtp(email, cleanOtp);
      setIsEmailVerified(true);
      clearError('otpCode');
      clearError('emailVerification');
      setStatusMessage('✓ Email verified successfully! You may now set your password below.');
      setStatusType('success');
    } catch (err: any) {
      setFieldErrors((prev) => ({ ...prev, otpCode: err?.message || 'Invalid or expired OTP code.' }));
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // 1. Submit Player Registration
  const handlePlayerSubmit = async () => {
    setStatusMessage(null);
    setStatusType(null);

    const name = pName.trim();
    const email = pEmail.trim().toLowerCase();
    const mobile = pMobile.trim();
    const targetTaluk = pTaluk === 'Other' ? pCustomTaluk.trim() : pTaluk;
    const newErrors: { [key: string]: string } = {};

    if (!name) newErrors.pName = 'Please enter Player Full Name.';
    if (!mobile || mobile.length < 10) newErrors.pMobile = 'Please enter a valid 10-digit Mobile Number.';
    if (!email || !validateEmail(email)) newErrors.pEmail = 'Please enter a valid Player Email address.';
    if (pTaluk === 'Other' && !targetTaluk) newErrors.pCustomTaluk = 'Please type your Taluk name.';
    if (!isEmailVerified) newErrors.emailVerification = 'Please verify your email address with OTP before submitting.';
    if (!password || password.length < 4) newErrors.password = 'Please enter a password of at least 4 characters.';
    if (password && password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match.';
    if (!pAgreed) newErrors.pAgreed = 'Please accept the declaration to submit player registration.';

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      return;
    }

    setIsLoading(true);
    setStatusMessage('Creating Player Account...');
    setStatusType('info');

    try {
      const resp = await ScorerApi.registerPlayer({
        name,
        email,
        password,
        mobile,
        role: pRole,
        category: pCategory,
        taluk: targetTaluk,
        battingStyle: pBattingStyle,
        bowlingStyle: pBowlingStyle,
        clubChoice: pClub.trim() || undefined,
        otp: otpCode.trim()
      });

      setIsLoading(false);
      setStatusMessage(resp?.message || '✓ Player Account Created! You can now log in.');
      setStatusType('success');

      if (Platform.OS === 'web') {
        alert(`✓ Registration Complete!\n\nWelcome ${name}! Your password is saved. You can now sign in.`);
      } else {
        Alert.alert('Registration Successful', `Welcome ${name}! You can now sign in with your password.`);
      }
      setTimeout(() => navigate('Login', { initialRole: 'PLAYER' }), 1200);
    } catch (err: any) {
      setIsLoading(false);
      const rawMsg = err?.message || 'Player registration failed. Please try again.';
      const lower = rawMsg.toLowerCase();
      if (lower.includes('email') || lower.includes('already exists') || lower.includes('registered')) {
        setFieldErrors((prev) => ({ ...prev, pEmail: rawMsg }));
      } else if (lower.includes('mobile') || lower.includes('phone')) {
        setFieldErrors((prev) => ({ ...prev, pMobile: rawMsg }));
      } else if (lower.includes('otp')) {
        setFieldErrors((prev) => ({ ...prev, otpCode: rawMsg }));
      } else {
        setFieldErrors((prev) => ({ ...prev, general: rawMsg }));
      }
    }
  };

  // 2. Team Squad Helpers & Submission
  const handleAddPlayer = () => {
    setStatusMessage(null);
    setStatusType(null);

    const name = squadPlayerName.trim();
    const email = squadPlayerEmail.trim().toLowerCase();
    const role = squadPlayerRole.trim() || 'Batter';
    const newErrors: { [key: string]: string } = {};

    if (!name) newErrors.squadPlayerName = 'Please enter Player Name.';
    if (!email || !validateEmail(email)) {
      newErrors.squadPlayerEmail = 'Please enter a valid Player Email ID.';
    } else if (coachEmail.trim() && email === coachEmail.trim().toLowerCase()) {
      newErrors.squadPlayerEmail = `Player email cannot be identical to Coach Email.`;
    } else if (players.some((p) => p.email.toLowerCase() === email)) {
      newErrors.squadPlayerEmail = `A player with email "${email}" has already been added to the squad.`;
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...newErrors }));
      return;
    }

    const newPlayer: SquadPlayer = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
      name,
      email,
      role
    };

    setPlayers((prev) => [...prev, newPlayer]);
    setSquadPlayerName('');
    setSquadPlayerEmail('');
    clearError('players');
    clearError('squadPlayerName');
    clearError('squadPlayerEmail');

    const newCount = players.length + 1;
    setStatusMessage(`✓ Added ${name} (${role}) to squad! (${newCount} players in squad)`);
    setStatusType('info');
  };

  const handleRemovePlayer = (id: string) => {
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  };

  const handleAutoFillSampleSquad = () => {
    if (!teamName.trim()) setTeamName('Virudhunagar Strikers Cricket Club');
    if (!coachName.trim()) setCoachName('S. Murugan (NIS Certified Coach)');
    if (!coachEmail.trim()) setCoachEmail('coach.murugan@strikerscc.org');

    const squad: SquadPlayer[] = SAMPLE_15_SQUAD.map((item, idx) => ({
      id: `sample-${idx + 1}-${Date.now()}`,
      name: item.name,
      email: item.email,
      role: item.role
    }));

    setPlayers(squad);
    clearError('players');
    setStatusMessage('⚡ Sample squad loaded! Coach details and all 15 squad players added.');
    setStatusType('success');
  };

  const handleTeamSubmit = async () => {
    setStatusMessage(null);
    setStatusType(null);

    const targetTaluk = teamTaluk === 'Other' ? teamCustomTaluk.trim() : teamTaluk;
    const newErrors: { [key: string]: string } = {};

    if (!teamName.trim()) newErrors.teamName = 'Please enter Team Name.';
    if (!coachName.trim()) newErrors.coachName = 'Please enter Coach / Manager Name.';
    if (!coachEmail.trim() || !validateEmail(coachEmail)) {
      newErrors.coachEmail = 'Please enter a valid Coach Email Address.';
    }
    if (teamTaluk === 'Other' && !targetTaluk) newErrors.teamCustomTaluk = 'Please type your team Taluk name.';
    if (players.length === 0) newErrors.players = 'Please add at least one squad player to your team.';
    if (!isEmailVerified) newErrors.emailVerification = 'Please verify coach email with the OTP code first.';
    if (!password || password.length < 4) newErrors.password = 'Please enter a password of at least 4 characters.';
    if (password && password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match.';
    if (!teamAgreed) newErrors.teamAgreed = 'Please accept the team declaration.';

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      return;
    }

    setIsLoading(true);
    setStatusMessage('Registering Team and Coach account...');
    setStatusType('info');

    try {
      const resp = await ScorerApi.registerTeam({
        teamName: teamName.trim(),
        coachName: coachName.trim(),
        coachEmail: coachEmail.trim().toLowerCase(),
        password,
        taluk: targetTaluk,
        city: 'Virudhunagar',
        players: players.map((p, idx) => ({
          jerseyNumber: idx + 1,
          name: p.name,
          email: p.email,
          role: p.role
        })),
        otp: otpCode.trim()
      });

      setIsLoading(false);
      const teamNotice = `✓ Registration Request Submitted!\n\nTeam "${teamName.trim()}" registration is PENDING Admin approval.\n\nOnce approved by District Administrator, Coach ${coachName} can log in with password.`;
      setStatusMessage(resp?.message || teamNotice);
      setStatusType('success');

      if (Platform.OS === 'web') {
        alert(teamNotice);
      } else {
        Alert.alert('Registration Request Submitted', `Team "${teamName.trim()}" registration is PENDING Admin approval.\n\nOnce approved by District Administrator, Coach ${coachName} can log in.`);
      }
      setTimeout(() => navigate('Login', { initialRole: 'TEAM' }), 1500);
    } catch (err: any) {
      setIsLoading(false);
      const rawMsg = err?.message || 'Team registration failed. Please try again.';
      const lower = rawMsg.toLowerCase();
      if (lower.includes('email') || lower.includes('already exists')) {
        setFieldErrors((prev) => ({ ...prev, coachEmail: rawMsg }));
      } else if (lower.includes('team name')) {
        setFieldErrors((prev) => ({ ...prev, teamName: rawMsg }));
      } else if (lower.includes('otp')) {
        setFieldErrors((prev) => ({ ...prev, otpCode: rawMsg }));
      } else {
        setFieldErrors((prev) => ({ ...prev, general: rawMsg }));
      }
    }
  };

  // 3. Submit Scorer Registration
  const handleScorerSubmit = async () => {
    setStatusMessage(null);
    setStatusType(null);

    const name = sName.trim();
    const email = sEmail.trim().toLowerCase();
    const mobile = sMobile.trim();
    const targetTaluk = sTaluk === 'Other' ? sCustomTaluk.trim() : sTaluk;
    const newErrors: { [key: string]: string } = {};

    if (!name) newErrors.sName = 'Please enter Scorer Full Name.';
    if (!mobile || mobile.length < 10) newErrors.sMobile = 'Please enter a valid 10-digit Mobile Number.';
    if (!email || !validateEmail(email)) newErrors.sEmail = 'Please enter a valid Scorer Email address.';
    if (sTaluk === 'Other' && !targetTaluk) newErrors.sCustomTaluk = 'Please type your Scorer Taluk name.';
    if (!isEmailVerified) newErrors.emailVerification = 'Please verify your email with the OTP code first.';
    if (!password || password.length < 4) newErrors.password = 'Please enter a password of at least 4 characters.';
    if (password && password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match.';
    if (!sAgreed) newErrors.sAgreed = 'Please accept the official scorer code of conduct declaration.';

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      return;
    }

    setIsLoading(true);
    setStatusMessage('Registering Official Scorer...');
    setStatusType('info');

    try {
      const resp = await ScorerApi.registerScorer({
        name,
        email,
        password,
        mobile,
        taluk: targetTaluk,
        certificationLevel: sLevel,
        otp: otpCode.trim()
      });

      setIsLoading(false);
      const scorerNotice = `✓ Registration Request Submitted!\n\nWelcome ${name}! Your scorer registration request is PENDING Admin approval.\n\nOnce approved by District Administrator, you can log in with password.`;
      setStatusMessage(resp?.message || scorerNotice);
      setStatusType('success');

      if (Platform.OS === 'web') {
        alert(scorerNotice);
      } else {
        Alert.alert('Registration Request Submitted', `Welcome ${name}! Your scorer registration request is PENDING Admin approval.\n\nOnce approved by District Administrator, you can log in.`);
      }
      setTimeout(() => navigate('Login', { initialRole: 'SCORER' }), 1500);
    } catch (err: any) {
      setIsLoading(false);
      const rawMsg = err?.message || 'Scorer registration failed. Please try again.';
      const lower = rawMsg.toLowerCase();
      if (lower.includes('email') || lower.includes('already exists')) {
        setFieldErrors((prev) => ({ ...prev, sEmail: rawMsg }));
      } else if (lower.includes('mobile') || lower.includes('phone')) {
        setFieldErrors((prev) => ({ ...prev, sMobile: rawMsg }));
      } else if (lower.includes('otp')) {
        setFieldErrors((prev) => ({ ...prev, otpCode: rawMsg }));
      } else {
        setFieldErrors((prev) => ({ ...prev, general: rawMsg }));
      }
    }
  };

  // 4. Submit Umpire Registration
  const handleUmpireSubmit = async () => {
    setStatusMessage(null);
    setStatusType(null);

    const name = uName.trim();
    const email = uEmail.trim().toLowerCase();
    const targetDistrict = uDistrict === 'Other' ? uCustomDistrict.trim() : uDistrict;
    const newErrors: { [key: string]: string } = {};

    if (!name) newErrors.uName = 'Please enter Umpire Full Name.';
    if (!email || !validateEmail(email)) newErrors.uEmail = 'Please enter a valid Umpire Email address.';
    if (!uExperience.trim()) newErrors.uExperience = 'Please enter Umpire Experience.';
    if (!uQualification.trim()) newErrors.uQualification = 'Please select Umpire Certification / Qualification.';
    if (uDistrict === 'Other' && !targetDistrict) newErrors.uCustomDistrict = 'Please specify your District name.';
    if (!uState.trim()) newErrors.uState = 'Please enter State.';
    if (!isEmailVerified) newErrors.emailVerification = 'Please verify your email with the OTP code first.';
    if (!password || password.length < 4) newErrors.password = 'Please enter a password of at least 4 characters.';
    if (password && password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match.';
    if (!uAgreed) newErrors.uAgreed = 'Please accept the official Umpires Code of Conduct declaration.';

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      return;
    }

    setIsLoading(true);
    setStatusMessage('Submitting Official Umpire Registration...');
    setStatusType('info');

    try {
      const resp = await ScorerApi.registerUmpire({
        name,
        email,
        password,
        experience: uExperience.trim(),
        experienceYears: uYearsOfExperience.trim() ? parseInt(uYearsOfExperience.trim(), 10) : undefined,
        qualification: uQualification,
        certificationNumber: uCertNumber.trim() || undefined,
        previousOrganization: uPrevOrg.trim() || undefined,
        specialization: uSpecialization,
        district: targetDistrict,
        state: uState.trim(),
        taluk: targetDistrict,
        profilePhoto: uProfilePhoto.trim() || undefined,
        additionalInfo: uAdditionalInfo.trim() || undefined,
        otp: otpCode.trim()
      });

      setIsLoading(false);
      const umpireNotice = `✓ Registration Request Submitted!\n\nWelcome ${name}!\nYour Umpire Registration is PENDING Admin approval.\n\nOnce approved by District Administrator, you can log in with your credentials to access the Official Umpire Dashboard.`;
      setStatusMessage(resp?.message || umpireNotice);
      setStatusType('success');

      if (Platform.OS === 'web') {
        alert(umpireNotice);
      } else {
        Alert.alert(
          'Registration Request Submitted',
          `Welcome ${name}!\n\nYour Umpire Registration is PENDING Admin approval.\n\nOnce approved by District Administrator, you can log in with your credentials to access the Official Umpire Dashboard.`
        );
      }
      setTimeout(() => navigate('Login', { initialRole: 'UMPIRE' }), 1500);
    } catch (err: any) {
      setIsLoading(false);
      const rawMsg = err?.message || 'Umpire registration failed. Please try again.';
      const lower = rawMsg.toLowerCase();
      if (lower.includes('email') || lower.includes('already exists')) {
        setFieldErrors((prev) => ({ ...prev, uEmail: rawMsg }));
      } else if (lower.includes('otp')) {
        setFieldErrors((prev) => ({ ...prev, otpCode: rawMsg }));
      } else {
        setFieldErrors((prev) => ({ ...prev, general: rawMsg }));
      }
    }
  };

  // Reusable Dropdown Component
  const DropdownField = ({
    label,
    value,
    options,
    onSelect,
    style
  }: {
    label: string;
    value: string;
    options: string[];
    onSelect: (val: string) => void;
    style?: any;
  }) => (
    <View style={[{ flex: 1 }, style]}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.dropdownBox}
        activeOpacity={0.7}
        onPress={() =>
          setPickerState({
            visible: true,
            title: `Select ${label.replace(' *', '')}`,
            options,
            selectedValue: value,
            onSelect
          })
        }
      >
        <Text style={styles.dropdownText} numberOfLines={1}>
          {value || 'Select...'}
        </Text>
        <Text style={styles.dropdownChevron}>▾</Text>
      </TouchableOpacity>
    </View>
  );

  // Render Verification and Password Box (in light theme)
  const renderVerificationAndPasswordBlock = () => {
    return (
      <View style={styles.verifBox}>
        <View style={styles.sectionHeaderBox}>
          <Text style={styles.sectionHeaderText}>📧 EMAIL VERIFICATION & PASSWORD SETUP</Text>
        </View>

        {!isEmailVerified ? (
          <View>
            <Text style={styles.verifHelpText}>
              Click below to send a 6-digit verification code to your email address before creating your password.
            </Text>

            <TouchableOpacity
              style={[styles.actionBtn, isSendingOtp && styles.btnDisabled]}
              onPress={handleSendEmailOtp}
              disabled={isSendingOtp}
            >
              {isSendingOtp ? (
                <ActivityIndicator color="#000000" size="small" />
              ) : (
                <Text style={styles.actionText}>
                  {otpSent ? 'Resend Verification OTP' : 'Send Verification OTP to Email'}
                </Text>
              )}
            </TouchableOpacity>
            {fieldErrors.emailVerification ? (
              <Text style={[styles.fieldErrorText, { marginTop: 6, textAlign: 'center' }]}>
                {fieldErrors.emailVerification}
              </Text>
            ) : null}

            {otpSent && (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.label}>Enter 6-Digit Email OTP *</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    style={[
                      styles.input,
                      { flex: 1, textAlign: 'center', letterSpacing: 4, fontWeight: 'bold', fontSize: 15, marginBottom: 0 },
                      fieldErrors.otpCode && styles.inputError
                    ]}
                    placeholder="123456"
                    placeholderTextColor="#94a3b8"
                    value={otpCode}
                    onChangeText={(text) => {
                      setOtpCode(text);
                      clearError('otpCode');
                    }}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <TouchableOpacity
                    style={[styles.verifyBtn, isVerifyingOtp && styles.btnDisabled]}
                    onPress={handleVerifyEmailOtp}
                    disabled={isVerifyingOtp}
                  >
                    {isVerifyingOtp ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Text style={styles.verifyBtnText}>Verify OTP</Text>
                    )}
                  </TouchableOpacity>
                </View>
                {fieldErrors.otpCode ? (
                  <Text style={styles.fieldErrorText}>{fieldErrors.otpCode}</Text>
                ) : null}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.verifiedCard}>
            <Text style={styles.verifiedCardText}>✓ Email Verified: {getTargetEmail()}</Text>
          </View>
        )}

        {isEmailVerified && (
          <View style={{ marginTop: 10 }}>
            <View style={styles.formRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Password (min 4 chars) *</Text>
                <View style={[styles.passwordContainer, fieldErrors.password && styles.inputError]}>
                  <TextInput
                    style={styles.passwordInput}
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      clearError('password');
                    }}
                    secureTextEntry={!showPassword}
                    placeholder="Enter password"
                    placeholderTextColor="#94a3b8"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Text style={styles.toggleText}>{showPassword ? '👁️' : '🔒'}</Text>
                  </TouchableOpacity>
                </View>
                {fieldErrors.password ? (
                  <Text style={styles.fieldErrorText}>{fieldErrors.password}</Text>
                ) : null}
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Confirm Password *</Text>
                <TextInput
                  style={[styles.input, { marginBottom: 0 }, fieldErrors.confirmPassword && styles.inputError]}
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    clearError('confirmPassword');
                  }}
                  secureTextEntry={!showPassword}
                  placeholder="Re-enter password"
                  placeholderTextColor="#94a3b8"
                />
                {fieldErrors.confirmPassword ? (
                  <Text style={styles.fieldErrorText}>{fieldErrors.confirmPassword}</Text>
                ) : null}
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <SharedBackground>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => (onExit ? onExit() : navigate('Home'))} style={styles.backBtn}>
            <Text style={styles.backText}>← Back to Home</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.cardContainer}>
            
            {/* Federation Logo & Header */}
            <View style={styles.logoContainer}>
              <Image
                source={require('../../../assets/logo_transparent.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.mainTitle}>CRICKET FEDERATION OF</Text>
              <Text style={styles.mainSubtitle}>VIRUDHUNAGAR DISTRICT</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.title}>Register Here</Text>
              <Text style={styles.subtitle}>
                District player registration, team squad submissions, and certified scorer enrollment
              </Text>

              {/* Status Banner - Only show success and info, NOT error banner */}
              {statusMessage && statusType !== 'error' && (
                <View
                  style={[
                    styles.statusBanner,
                    statusType === 'success' && styles.statusSuccess,
                    statusType === 'info' && styles.statusInfo
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      statusType === 'success' && styles.statusTextSuccess,
                      statusType === 'info' && styles.statusTextInfo
                    ]}
                  >
                    {statusMessage}
                  </Text>
                </View>
              )}

              {/* Role Selection Tabs */}
              <View style={styles.roleTabsContainer}>
                <TouchableOpacity
                  style={[styles.roleTab, activeRole === 'PLAYER' && styles.roleTabActive]}
                  onPress={() => switchRole('PLAYER')}
                >
                  <Text style={[styles.roleTabText, activeRole === 'PLAYER' && styles.roleTabTextActive]}>
                    🏏 Player
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.roleTab, activeRole === 'TEAM' && styles.roleTabActive]}
                  onPress={() => switchRole('TEAM')}
                >
                  <Text style={[styles.roleTabText, activeRole === 'TEAM' && styles.roleTabTextActive]}>
                    🛡️ Team & Coach
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.roleTab, activeRole === 'SCORER' && styles.roleTabActive]}
                  onPress={() => switchRole('SCORER')}
                >
                  <Text style={[styles.roleTabText, activeRole === 'SCORER' && styles.roleTabTextActive]}>
                    📋 Scorer
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.roleTab, activeRole === 'UMPIRE' && styles.roleTabActive]}
                  onPress={() => switchRole('UMPIRE')}
                >
                  <Text style={[styles.roleTabText, activeRole === 'UMPIRE' && styles.roleTabTextActive]}>
                    ⚖️ Umpire
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ========================================================= */}
              {/* 1. PLAYER FORM */}
              {/* ========================================================= */}
              {activeRole === 'PLAYER' && (
                <>
                  <View style={styles.sectionHeaderBox}>
                    <Text style={styles.sectionHeaderText}>🏏 PLAYER PERSONAL & CRICKETING PROFILE</Text>
                  </View>

                  {/* Row 1: Player Full Name (left) & Mobile Number (right) */}
                  <View style={styles.formRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Player Full Name *</Text>
                      <TextInput
                        style={[styles.input, fieldErrors.pName && styles.inputError]}
                        value={pName}
                        onChangeText={(text) => {
                          setPName(text);
                          clearError('pName');
                        }}
                        placeholder="e.g. R. Saravanan"
                        placeholderTextColor="#94a3b8"
                        autoCapitalize="words"
                      />
                      {fieldErrors.pName ? <Text style={styles.fieldErrorText}>{fieldErrors.pName}</Text> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Mobile Number (10 Digits) *</Text>
                      <TextInput
                        style={[styles.input, fieldErrors.pMobile && styles.inputError]}
                        value={pMobile}
                        onChangeText={(text) => {
                          setPMobile(text);
                          clearError('pMobile');
                        }}
                        placeholder="e.g. 9876543210"
                        keyboardType="phone-pad"
                        placeholderTextColor="#94a3b8"
                        maxLength={10}
                      />
                      {fieldErrors.pMobile ? <Text style={styles.fieldErrorText}>{fieldErrors.pMobile}</Text> : null}
                    </View>
                  </View>

                  {/* Row 2: Player Email Address */}
                  <View style={styles.formRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Player Email Address *</Text>
                      <TextInput
                        style={[styles.input, fieldErrors.pEmail && styles.inputError]}
                        value={pEmail}
                        onChangeText={(text) => {
                          setPEmail(text);
                          clearError('pEmail');
                        }}
                        placeholder="e.g. saravanan@example.com"
                        keyboardType="email-address"
                        placeholderTextColor="#94a3b8"
                        autoCapitalize="none"
                      />
                      {fieldErrors.pEmail ? <Text style={styles.fieldErrorText}>{fieldErrors.pEmail}</Text> : null}
                    </View>
                  </View>

                  {/* Row 3: Playing Role (left) & Taluk Jurisdiction (right) Dropdowns */}
                  <View style={styles.formRow}>
                    <DropdownField
                      label="Playing Role"
                      value={pRole}
                      options={PLAYER_ROLES}
                      onSelect={setPRole}
                    />
                    <DropdownField
                      label="Taluk Jurisdiction"
                      value={pTaluk}
                      options={TALUK_OPTIONS}
                      onSelect={(val) => {
                        setPTaluk(val);
                        if (val !== 'Other') setPCustomTaluk('');
                        clearError('pCustomTaluk');
                      }}
                    />
                  </View>

                  {/* Custom Taluk Input if "Other" is chosen */}
                  {pTaluk === 'Other' && (
                    <View style={styles.formRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Specify Taluk Name *</Text>
                        <TextInput
                          style={[styles.input, fieldErrors.pCustomTaluk && styles.inputError]}
                          value={pCustomTaluk}
                          onChangeText={(text) => {
                            setPCustomTaluk(text);
                            clearError('pCustomTaluk');
                          }}
                          placeholder="Type your taluk name here..."
                          placeholderTextColor="#94a3b8"
                          autoCapitalize="words"
                        />
                        {fieldErrors.pCustomTaluk ? <Text style={styles.fieldErrorText}>{fieldErrors.pCustomTaluk}</Text> : null}
                      </View>
                    </View>
                  )}

                  {/* Verification & Password Setup */}
                  {renderVerificationAndPasswordBlock()}

                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => {
                      setPAgreed(!pAgreed);
                      clearError('pAgreed');
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.checkbox, pAgreed && styles.checkboxChecked]}>
                      {pAgreed && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.checkboxLabel}>
                      I hereby declare that all information furnished is true and accurate according to association guidelines.
                    </Text>
                  </TouchableOpacity>
                  {fieldErrors.pAgreed ? <Text style={styles.fieldErrorText}>{fieldErrors.pAgreed}</Text> : null}

                  {fieldErrors.general ? (
                    <View style={styles.generalErrorBox}>
                      <Text style={styles.generalErrorText}>{fieldErrors.general}</Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={[styles.submitBtn, (!isEmailVerified || isLoading) && styles.submitBtnDisabled]}
                    onPress={handlePlayerSubmit}
                    disabled={!isEmailVerified || isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#000000" size="small" />
                    ) : (
                      <Text style={styles.submitBtnText}>Submit Player Registration</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}

              {/* ========================================================= */}
              {/* 2. TEAM & COACH FORM */}
              {/* ========================================================= */}
              {activeRole === 'TEAM' && (
                <>
                  <View style={styles.sectionHeaderBox}>
                    <Text style={styles.sectionHeaderText}>🛡️ TEAM CLUB & COACH PROFILE</Text>
                  </View>

                  {/* Row 1: Team Name (left) & Coach Name (right) */}
                  <View style={styles.formRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Official Club / Team Name *</Text>
                      <TextInput
                        style={[styles.input, fieldErrors.teamName && styles.inputError]}
                        value={teamName}
                        onChangeText={(text) => {
                          setTeamName(text);
                          clearError('teamName');
                        }}
                        placeholder="e.g. Sivakasi Super Strikers"
                        placeholderTextColor="#94a3b8"
                      />
                      {fieldErrors.teamName ? <Text style={styles.fieldErrorText}>{fieldErrors.teamName}</Text> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Head Coach / Manager Name *</Text>
                      <TextInput
                        style={[styles.input, fieldErrors.coachName && styles.inputError]}
                        value={coachName}
                        onChangeText={(text) => {
                          setCoachName(text);
                          clearError('coachName');
                        }}
                        placeholder="e.g. Coach S. Murugan"
                        placeholderTextColor="#94a3b8"
                      />
                      {fieldErrors.coachName ? <Text style={styles.fieldErrorText}>{fieldErrors.coachName}</Text> : null}
                    </View>
                  </View>

                  {/* Row 2: Coach Email (left) & Team Taluk (right) */}
                  <View style={styles.formRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Coach Official Email Address *</Text>
                      <TextInput
                        style={[styles.input, fieldErrors.coachEmail && styles.inputError]}
                        value={coachEmail}
                        onChangeText={(text) => {
                          setCoachEmail(text);
                          clearError('coachEmail');
                        }}
                        placeholder="e.g. coach@strikerscc.org"
                        keyboardType="email-address"
                        placeholderTextColor="#94a3b8"
                        autoCapitalize="none"
                      />
                      {fieldErrors.coachEmail ? <Text style={styles.fieldErrorText}>{fieldErrors.coachEmail}</Text> : null}
                    </View>
                    <DropdownField
                      label="Team Taluk Jurisdiction"
                      value={teamTaluk}
                      options={TALUK_OPTIONS}
                      onSelect={(val) => {
                        setTeamTaluk(val);
                        if (val !== 'Other') setTeamCustomTaluk('');
                        clearError('teamCustomTaluk');
                      }}
                    />
                  </View>

                  {/* Custom Taluk Input if "Other" is chosen */}
                  {teamTaluk === 'Other' && (
                    <View style={styles.formRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Specify Team Taluk Name *</Text>
                        <TextInput
                          style={[styles.input, fieldErrors.teamCustomTaluk && styles.inputError]}
                          value={teamCustomTaluk}
                          onChangeText={(text) => {
                            setTeamCustomTaluk(text);
                            clearError('teamCustomTaluk');
                          }}
                          placeholder="Type your team's taluk name here..."
                          placeholderTextColor="#94a3b8"
                          autoCapitalize="words"
                        />
                        {fieldErrors.teamCustomTaluk ? <Text style={styles.fieldErrorText}>{fieldErrors.teamCustomTaluk}</Text> : null}
                      </View>
                    </View>
                  )}

                  {/* 15 Squad Players Builder */}
                  <View style={styles.squadHeaderRow}>
                    <Text style={styles.squadSectionTitle}>
                      Squad Players ({players.length} added)
                    </Text>
                    <TouchableOpacity style={styles.autoFillBtn} onPress={handleAutoFillSampleSquad}>
                      <Text style={styles.autoFillBtnText}>⚡ Fill Sample Squad</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.addPlayerContainer}>
                    <View style={styles.formRow}>
                      <View style={{ flex: 1 }}>
                        <TextInput
                          style={[styles.input, { marginBottom: 0 }, fieldErrors.squadPlayerName && styles.inputError]}
                          value={squadPlayerName}
                          onChangeText={(text) => {
                            setSquadPlayerName(text);
                            clearError('squadPlayerName');
                          }}
                          placeholder="Player Full Name"
                          placeholderTextColor="#94a3b8"
                        />
                        {fieldErrors.squadPlayerName ? <Text style={styles.fieldErrorText}>{fieldErrors.squadPlayerName}</Text> : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <TextInput
                          style={[styles.input, { marginBottom: 0 }, fieldErrors.squadPlayerEmail && styles.inputError]}
                          value={squadPlayerEmail}
                          onChangeText={(text) => {
                            setSquadPlayerEmail(text);
                            clearError('squadPlayerEmail');
                          }}
                          placeholder="Player Email Address"
                          keyboardType="email-address"
                          placeholderTextColor="#94a3b8"
                          autoCapitalize="none"
                        />
                        {fieldErrors.squadPlayerEmail ? <Text style={styles.fieldErrorText}>{fieldErrors.squadPlayerEmail}</Text> : null}
                      </View>
                    </View>
                    <View style={[styles.formRow, { marginTop: 8, marginBottom: 0 }]}>
                      <DropdownField
                        label="Squad Role"
                        value={squadPlayerRole}
                        options={COMMON_ROLES}
                        onSelect={setSquadPlayerRole}
                      />
                      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                        <TouchableOpacity style={styles.addPlayerBtn} onPress={handleAddPlayer}>
                          <Text style={styles.addPlayerBtnText}>+ Add to Squad</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                  {fieldErrors.players ? (
                    <Text style={[styles.fieldErrorText, { marginTop: 4, marginLeft: 2 }]}>
                      {fieldErrors.players}
                    </Text>
                  ) : null}

                  {players.length > 0 && (
                    <View style={styles.playerListContainer}>
                      {players.map((p, index) => (
                        <View key={p.id} style={styles.playerItemRow}>
                          <View style={styles.playerNumBadge}>
                            <Text style={styles.playerNumText}>#{index + 1}</Text>
                          </View>
                          <View style={styles.playerItemDetails}>
                            <View style={styles.playerNameRoleRow}>
                              <Text style={styles.playerItemName}>{p.name}</Text>
                              <View style={styles.playerItemRoleBadge}>
                                <Text style={styles.playerItemRoleText}>{p.role}</Text>
                              </View>
                            </View>
                            <Text style={styles.playerItemEmail}>{p.email}</Text>
                          </View>
                          <TouchableOpacity onPress={() => handleRemovePlayer(p.id)} style={styles.removeBtn}>
                            <Text style={styles.removeBtnText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Verification & Password Setup */}
                  {renderVerificationAndPasswordBlock()}

                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => {
                      setTeamAgreed(!teamAgreed);
                      clearError('teamAgreed');
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.checkbox, teamAgreed && styles.checkboxChecked]}>
                      {teamAgreed && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.checkboxLabel}>
                      I confirm that all squad players have verified identity documents.
                    </Text>
                  </TouchableOpacity>
                  {fieldErrors.teamAgreed ? <Text style={styles.fieldErrorText}>{fieldErrors.teamAgreed}</Text> : null}

                  {fieldErrors.general ? (
                    <View style={styles.generalErrorBox}>
                      <Text style={styles.generalErrorText}>{fieldErrors.general}</Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={[styles.submitBtn, (!isEmailVerified || players.length === 0 || isLoading) && styles.submitBtnDisabled]}
                    onPress={handleTeamSubmit}
                    disabled={!isEmailVerified || players.length === 0 || isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#000000" size="small" />
                    ) : (
                      <Text style={styles.submitBtnText}>Submit Team & Coach Registration</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}

              {/* ========================================================= */}
              {/* 3. SCORER FORM */}
              {/* ========================================================= */}
              {activeRole === 'SCORER' && (
                <>
                  <View style={styles.sectionHeaderBox}>
                    <Text style={styles.sectionHeaderText}>📋 OFFICIAL SCORER ENROLLMENT</Text>
                  </View>

                  {/* Row 1: Scorer Full Name (left) & Mobile Number (right) */}
                  <View style={styles.formRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Scorer Full Name *</Text>
                      <TextInput
                        style={[styles.input, fieldErrors.sName && styles.inputError]}
                        value={sName}
                        onChangeText={(text) => {
                          setSName(text);
                          clearError('sName');
                        }}
                        placeholder="e.g. S. Ramesh"
                        placeholderTextColor="#94a3b8"
                        autoCapitalize="words"
                      />
                      {fieldErrors.sName ? <Text style={styles.fieldErrorText}>{fieldErrors.sName}</Text> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Mobile Number *</Text>
                      <TextInput
                        style={[styles.input, fieldErrors.sMobile && styles.inputError]}
                        value={sMobile}
                        onChangeText={(text) => {
                          setSMobile(text);
                          clearError('sMobile');
                        }}
                        placeholder="e.g. 9876543210"
                        keyboardType="phone-pad"
                        placeholderTextColor="#94a3b8"
                        maxLength={10}
                      />
                      {fieldErrors.sMobile ? <Text style={styles.fieldErrorText}>{fieldErrors.sMobile}</Text> : null}
                    </View>
                  </View>

                  {/* Row 2: Official Scorer Email */}
                  <View style={styles.formRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Official Scorer Email *</Text>
                      <TextInput
                        style={[styles.input, fieldErrors.sEmail && styles.inputError]}
                        value={sEmail}
                        onChangeText={(text) => {
                          setSEmail(text);
                          clearError('sEmail');
                        }}
                        placeholder="e.g. ramesh.scorer@cfvd.org"
                        keyboardType="email-address"
                        placeholderTextColor="#94a3b8"
                        autoCapitalize="none"
                      />
                      {fieldErrors.sEmail ? <Text style={styles.fieldErrorText}>{fieldErrors.sEmail}</Text> : null}
                    </View>
                  </View>

                  {/* Row 3: Certification Level (left) & Taluk Jurisdiction (right) Dropdowns */}
                  <View style={styles.formRow}>
                    <DropdownField
                      label="Certification Level"
                      value={sLevel}
                      options={SCORER_LEVELS}
                      onSelect={setSLevel}
                    />
                    <DropdownField
                      label="Taluk Jurisdiction"
                      value={sTaluk}
                      options={TALUK_OPTIONS}
                      onSelect={(val) => {
                        setSTaluk(val);
                        if (val !== 'Other') setSCustomTaluk('');
                        clearError('sCustomTaluk');
                      }}
                    />
                  </View>

                  {/* Custom Taluk Input if "Other" is chosen */}
                  {sTaluk === 'Other' && (
                    <View style={styles.formRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Specify Scorer Taluk Name *</Text>
                        <TextInput
                          style={[styles.input, fieldErrors.sCustomTaluk && styles.inputError]}
                          value={sCustomTaluk}
                          onChangeText={(text) => {
                            setSCustomTaluk(text);
                            clearError('sCustomTaluk');
                          }}
                          placeholder="Type your taluk name here..."
                          placeholderTextColor="#94a3b8"
                          autoCapitalize="words"
                        />
                        {fieldErrors.sCustomTaluk ? <Text style={styles.fieldErrorText}>{fieldErrors.sCustomTaluk}</Text> : null}
                      </View>
                    </View>
                  )}

                  {/* Verification & Password Setup */}
                  {renderVerificationAndPasswordBlock()}

                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => {
                      setSAgreed(!sAgreed);
                      clearError('sAgreed');
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.checkbox, sAgreed && styles.checkboxChecked]}>
                      {sAgreed && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.checkboxLabel}>
                      I agree to abide by the official BCCI / TNCA and District Scorer Code of Conduct.
                    </Text>
                  </TouchableOpacity>
                  {fieldErrors.sAgreed ? <Text style={styles.fieldErrorText}>{fieldErrors.sAgreed}</Text> : null}

                  {fieldErrors.general ? (
                    <View style={styles.generalErrorBox}>
                      <Text style={styles.generalErrorText}>{fieldErrors.general}</Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={[styles.submitBtn, (!isEmailVerified || isLoading) && styles.submitBtnDisabled]}
                    onPress={handleScorerSubmit}
                    disabled={!isEmailVerified || isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#000000" size="small" />
                    ) : (
                      <Text style={styles.submitBtnText}>Submit Scorer Registration</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}

              {/* ========================================================= */}
              {/* 4. UMPIRE FORM */}
              {/* ========================================================= */}
              {activeRole === 'UMPIRE' && (
                <>
                  <View style={styles.sectionHeaderBox}>
                    <Text style={styles.sectionHeaderText}>⚖️ OFFICIAL UMPIRE REGISTRATION & ACCREDITATION</Text>
                  </View>

                  {/* Row 1: Umpire Full Name */}
                  <View style={styles.formRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Umpire Full Name *</Text>
                      <TextInput
                        style={[styles.input, fieldErrors.uName && styles.inputError]}
                        value={uName}
                        onChangeText={(text) => {
                          setUName(text);
                          clearError('uName');
                        }}
                        placeholder="e.g. K. Sundararajan"
                        placeholderTextColor="#94a3b8"
                        autoCapitalize="words"
                      />
                      {fieldErrors.uName ? <Text style={styles.fieldErrorText}>{fieldErrors.uName}</Text> : null}
                    </View>
                  </View>

                  {/* Row 2: Official Umpire Email */}
                  <View style={styles.formRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Official Umpire Email *</Text>
                      <TextInput
                        style={[styles.input, fieldErrors.uEmail && styles.inputError]}
                        value={uEmail}
                        onChangeText={(text) => {
                          setUEmail(text);
                          clearError('uEmail');
                        }}
                        placeholder="e.g. sundararajan.umpire@cfvd.org"
                        keyboardType="email-address"
                        placeholderTextColor="#94a3b8"
                        autoCapitalize="none"
                      />
                      {fieldErrors.uEmail ? <Text style={styles.fieldErrorText}>{fieldErrors.uEmail}</Text> : null}
                    </View>
                  </View>

                  {/* Row 3: Certification/Qualification & Umpire Experience */}
                  <View style={styles.formRow}>
                    <DropdownField
                      label="Umpire Certification / Qualification *"
                      value={uQualification}
                      options={UMPIRE_QUALIFICATIONS}
                      onSelect={(val) => {
                        setUQualification(val);
                        clearError('uQualification');
                      }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Umpire Experience *</Text>
                      <TextInput
                        style={[styles.input, fieldErrors.uExperience && styles.inputError]}
                        value={uExperience}
                        onChangeText={(text) => {
                          setUExperience(text);
                          clearError('uExperience');
                        }}
                        placeholder="e.g. 6 Years / Senior Panel"
                        placeholderTextColor="#94a3b8"
                      />
                      {fieldErrors.uExperience ? <Text style={styles.fieldErrorText}>{fieldErrors.uExperience}</Text> : null}
                    </View>
                  </View>
                  {fieldErrors.uQualification ? (
                    <Text style={[styles.fieldErrorText, { marginTop: -6, marginBottom: 8 }]}>
                      {fieldErrors.uQualification}
                    </Text>
                  ) : null}

                  {/* Row 4: District & State */}
                  <View style={styles.formRow}>
                    <DropdownField
                      label="District *"
                      value={uDistrict}
                      options={DISTRICT_OPTIONS}
                      onSelect={(val) => {
                        setUDistrict(val);
                        if (val !== 'Other') setUCustomDistrict('');
                        clearError('uCustomDistrict');
                      }}
                    />
                    <DropdownField
                      label="State *"
                      value={uState}
                      options={STATE_OPTIONS}
                      onSelect={setUState}
                    />
                  </View>

                  {/* Custom District Input if "Other" is chosen */}
                  {uDistrict === 'Other' && (
                    <View style={styles.formRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Specify District Name *</Text>
                        <TextInput
                          style={[styles.input, fieldErrors.uCustomDistrict && styles.inputError]}
                          value={uCustomDistrict}
                          onChangeText={(text) => {
                            setUCustomDistrict(text);
                            clearError('uCustomDistrict');
                          }}
                          placeholder="Type your district name here..."
                          placeholderTextColor="#94a3b8"
                          autoCapitalize="words"
                        />
                        {fieldErrors.uCustomDistrict ? <Text style={styles.fieldErrorText}>{fieldErrors.uCustomDistrict}</Text> : null}
                      </View>
                    </View>
                  )}

                  {/* Toggle Optional Fields Button */}
                  <TouchableOpacity
                    style={styles.optionalToggleBtn}
                    onPress={() => setShowOptionalUmpireFields(!showOptionalUmpireFields)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.optionalToggleText}>
                      {showOptionalUmpireFields ? '▾ Hide Optional Profile Information' : '▸ Add Optional Profile Information (ID, Bio, Photos, Org)'}
                    </Text>
                  </TouchableOpacity>

                  {/* Optional Fields Section */}
                  {showOptionalUmpireFields && (
                    <View style={styles.optionalContainer}>
                      <View style={styles.formRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.label}>Umpire ID / Certification Number</Text>
                          <TextInput
                            style={styles.input}
                            value={uCertNumber}
                            onChangeText={setUCertNumber}
                            placeholder="e.g. TNCA-UMP-2024-042"
                            placeholderTextColor="#94a3b8"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.label}>Years of Experience (Numeric)</Text>
                          <TextInput
                            style={styles.input}
                            value={uYearsOfExperience}
                            onChangeText={setUYearsOfExperience}
                            placeholder="e.g. 6"
                            keyboardType="number-pad"
                            placeholderTextColor="#94a3b8"
                            maxLength={2}
                          />
                        </View>
                      </View>

                      <View style={styles.formRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.label}>Previous Association / Organization</Text>
                          <TextInput
                            style={styles.input}
                            value={uPrevOrg}
                            onChangeText={setUPrevOrg}
                            placeholder="e.g. Tamil Nadu Cricket Association"
                            placeholderTextColor="#94a3b8"
                          />
                        </View>
                        <DropdownField
                          label="Specialization"
                          value={uSpecialization}
                          options={UMPIRE_SPECIALIZATIONS}
                          onSelect={setUSpecialization}
                        />
                      </View>

                      <View style={styles.formRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.label}>Profile Photo URL</Text>
                          <TextInput
                            style={styles.input}
                            value={uProfilePhoto}
                            onChangeText={setUProfilePhoto}
                            placeholder="https://example.com/photo.jpg"
                            placeholderTextColor="#94a3b8"
                            autoCapitalize="none"
                          />
                        </View>
                      </View>

                      <View style={styles.formRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.label}>Additional Information / Officiating Bio</Text>
                          <TextInput
                            style={[styles.input, { height: 60, textAlignVertical: 'top', paddingTop: 8 }]}
                            value={uAdditionalInfo}
                            onChangeText={setUAdditionalInfo}
                            placeholder="Tournaments officiated, awards, or special credentials..."
                            placeholderTextColor="#94a3b8"
                            multiline
                          />
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Verification & Password Setup */}
                  {renderVerificationAndPasswordBlock()}

                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => {
                      setUAgreed(!uAgreed);
                      clearError('uAgreed');
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.checkbox, uAgreed && styles.checkboxChecked]}>
                      {uAgreed && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.checkboxLabel}>
                      I hereby declare that all information furnished is true and I agree to abide by the official ICC / BCCI / TNCA and District Umpires Code of Conduct & Ethics.
                    </Text>
                  </TouchableOpacity>
                  {fieldErrors.uAgreed ? <Text style={styles.fieldErrorText}>{fieldErrors.uAgreed}</Text> : null}

                  {fieldErrors.general ? (
                    <View style={styles.generalErrorBox}>
                      <Text style={styles.generalErrorText}>{fieldErrors.general}</Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={[styles.submitBtn, (!isEmailVerified || isLoading) && styles.submitBtnDisabled]}
                    onPress={handleUmpireSubmit}
                    disabled={!isEmailVerified || isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#000000" size="small" />
                    ) : (
                      <Text style={styles.submitBtnText}>Submit Umpire Registration</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}

              {/* Login link */}
              <View style={styles.loginPromptRow}>
                <Text style={styles.promptNormalText}>Already registered? </Text>
                <TouchableOpacity onPress={() => navigate('Login', { initialRole: activeRole })}>
                  <Text style={styles.loginLinkText}>Login Here →</Text>
                </TouchableOpacity>
              </View>

            </View>
          </View>
        </ScrollView>

        {/* Global Reusable Dropdown Modal */}
        {pickerState && (
          <Modal
            visible={pickerState.visible}
            transparent
            animationType="fade"
            onRequestClose={() => setPickerState(null)}
          >
            <TouchableOpacity
              style={styles.modalBackdrop}
              activeOpacity={1}
              onPress={() => setPickerState(null)}
            >
              <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{pickerState.title}</Text>
                  <TouchableOpacity onPress={() => setPickerState(null)} style={styles.modalCloseBtn}>
                    <Text style={styles.modalCloseBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
                  {pickerState.options.map((opt) => {
                    const isSelected = opt === pickerState.selectedValue;
                    return (
                      <TouchableOpacity
                        key={opt}
                        style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                        onPress={() => {
                          pickerState.onSelect(opt);
                          setPickerState(null);
                        }}
                      >
                        <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
                          {opt}
                        </Text>
                        {isSelected && <Text style={styles.modalCheckmark}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </TouchableOpacity>
          </Modal>
        )}
      </View>
    </SharedBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent', width: '100%' },
  header: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4
  },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { color: '#eab308', fontSize: 14.5, fontWeight: 'bold' },
  scroll: { flexGrow: 1, width: '100%' },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    paddingBottom: 24,
    width: '100%'
  },
  logoContainer: { alignItems: 'center', marginBottom: 10, marginTop: 4 },
  logo: { width: 50, height: 50, marginBottom: 4 },
  mainTitle: { color: '#1e293b', fontSize: 13, fontWeight: 'bold', letterSpacing: 0.8 },
  mainSubtitle: { color: '#b45309', fontSize: 17, fontWeight: '900', letterSpacing: 0.8 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    width: '100%',
    maxWidth: 640,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4
  },
  title: { color: '#1e293b', fontSize: 20, fontWeight: 'bold', marginBottom: 2, textAlign: 'center' },
  subtitle: { color: '#64748b', fontSize: 12, marginBottom: 14, textAlign: 'center', lineHeight: 16 },

  statusBanner: { padding: 10, borderRadius: 6, marginBottom: 12, borderWidth: 1 },
  statusError: { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
  statusSuccess: { backgroundColor: '#f0fdf4', borderColor: '#86efac' },
  statusInfo: { backgroundColor: '#eff6ff', borderColor: '#93c5fd' },
  statusText: { fontSize: 12.5, fontWeight: '600', textAlign: 'center' },
  statusTextError: { color: '#b91c1c' },
  statusTextSuccess: { color: '#15803d' },
  statusTextInfo: { color: '#1d4ed8' },

  roleTabsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
    justifyContent: 'center'
  },
  roleTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  roleTabActive: {
    backgroundColor: '#1e293b',
    borderColor: '#1e293b'
  },
  roleTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569'
  },
  roleTabTextActive: {
    color: '#ffffff',
    fontWeight: '800'
  },

  sectionHeaderBox: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 12,
    marginTop: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#eab308'
  },
  sectionHeaderText: {
    color: '#0f172a',
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.3
  },

  formRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
    alignItems: 'flex-start'
  },
  label: { color: '#334155', fontSize: 12, marginBottom: 4, fontWeight: '700' },
  input: {
    backgroundColor: '#f8fafc',
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
    fontSize: 13,
    height: 38
  },
  inputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2'
  },
  fieldErrorText: {
    color: '#dc2626',
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 3,
    marginBottom: 4,
    lineHeight: 14
  },
  generalErrorBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
    borderWidth: 1,
    padding: 10,
    borderRadius: 6,
    marginVertical: 10
  },
  generalErrorText: {
    color: '#b91c1c',
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'center'
  },

  // Dropdown Box
  dropdownBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 10,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  dropdownText: {
    color: '#1e293b',
    fontSize: 13,
    fontWeight: '600',
    flex: 1
  },
  dropdownChevron: {
    color: '#64748b',
    fontSize: 14,
    marginLeft: 4,
    fontWeight: 'bold'
  },

  // Verification Box
  verifBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 10,
    marginVertical: 8
  },
  verifHelpText: {
    color: '#64748b',
    fontSize: 11.5,
    marginBottom: 8,
    lineHeight: 16
  },
  actionBtn: {
    backgroundColor: '#eab308',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center'
  },
  actionText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 12.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  verifyBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 14,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    height: 38
  },
  verifyBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: 'bold'
  },
  verifiedCard: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 6,
    padding: 8,
    alignItems: 'center'
  },
  verifiedCardText: {
    color: '#15803d',
    fontSize: 12.5,
    fontWeight: 'bold'
  },
  passwordContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    alignItems: 'center',
    paddingRight: 10,
    height: 38
  },
  passwordInput: {
    flex: 1,
    color: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13
  },
  toggleText: {
    fontSize: 14
  },
  btnDisabled: {
    opacity: 0.6
  },

  // Squad
  squadHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  squadSectionTitle: {
    color: '#334155',
    fontSize: 12.5,
    fontWeight: '700'
  },
  autoFillBtn: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4
  },
  autoFillBtnText: {
    color: '#1d4ed8',
    fontSize: 11,
    fontWeight: '800'
  },
  addPlayerContainer: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    borderRadius: 6,
    marginBottom: 10
  },
  addPlayerBtn: {
    backgroundColor: '#1e293b',
    height: 38,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center'
  },
  addPlayerBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  },
  playerListContainer: {
    marginBottom: 10
  },
  playerItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 8,
    borderRadius: 6,
    marginBottom: 4
  },
  playerNumBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8
  },
  playerNumText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569'
  },
  playerItemDetails: {
    flex: 1
  },
  playerNameRoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  playerItemName: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0f172a'
  },
  playerItemRoleBadge: {
    backgroundColor: 'rgba(234, 179, 8, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3
  },
  playerItemRoleText: {
    color: '#92400e',
    fontSize: 10,
    fontWeight: '800'
  },
  playerItemEmail: {
    fontSize: 11,
    color: '#64748b'
  },
  removeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center'
  },
  removeBtnText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '900'
  },

  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    gap: 8
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff'
  },
  checkboxChecked: {
    backgroundColor: '#eab308',
    borderColor: '#ca8a04'
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold'
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 11.5,
    color: '#475569',
    lineHeight: 16
  },

  submitBtn: {
    backgroundColor: '#eab308',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 6,
    shadowColor: '#eab308',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4
  },
  submitBtnDisabled: {
    backgroundColor: '#cbd5e1',
    shadowOpacity: 0
  },
  submitBtnText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 13.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },

  loginPromptRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  promptNormalText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '400'
  },
  loginLinkText: {
    color: '#b45309',
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline'
  },

  // Modal Dropdown Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 380,
    maxHeight: '75%',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 8
  },
  modalTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0f172a'
  },
  modalCloseBtn: {
    padding: 4
  },
  modalCloseBtnText: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: 'bold'
  },
  modalList: {
    maxHeight: 300
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginVertical: 2
  },
  modalItemSelected: {
    backgroundColor: '#fef3c7'
  },
  modalItemText: {
    fontSize: 13.5,
    color: '#334155',
    fontWeight: '500'
  },
  modalItemTextSelected: {
    color: '#92400e',
    fontWeight: '800'
  },
  modalCheckmark: {
    fontSize: 13,
    color: '#b45309',
    fontWeight: '900'
  },
  optionalToggleBtn: {
    backgroundColor: '#f8fafc',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
    alignItems: 'center'
  },
  optionalToggleText: {
    color: '#0284c7',
    fontSize: 12,
    fontWeight: '700'
  },
  optionalContainer: {
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12
  }
});
