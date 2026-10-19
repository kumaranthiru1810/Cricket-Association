import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ImageBackground,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { useAppNavigation } from '../../navigation/AppNavigator';
import { ScorerApi } from '../../services/api';
import { showSuccess, showError, showWarning, showInfo } from '../../utils/sweetalert';

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

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isDesktop = windowWidth >= 640;

  const [activeRole, setActiveRole] = useState<RegistrationRole>(getInitialRole());

  // Global loading and status
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSendingOtp, setIsSendingOtp] = useState<boolean>(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'info' | 'success' | 'error' | null>(null);

  // OTP & Password State
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [otpCode, setOtpCode] = useState<string>('');
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Cricket OTP Popup Modal State
  const [isOtpModalVisible, setIsOtpModalVisible] = useState<boolean>(false);
  const [popupEmail, setPopupEmail] = useState<string>('');
  const [otpModalError, setOtpModalError] = useState<string | null>(null);
  const [otpModalSuccess, setOtpModalSuccess] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  // Pending Admin Approval Popup Modal State
  const [showApprovalPendingModal, setShowApprovalPendingModal] = useState<boolean>(false);
  const [pendingApprovalData, setPendingApprovalData] = useState<{
    name: string;
    email: string;
    role: string;
    certificationLevel?: string;
    taluk?: string;
  } | null>(null);

  // Cooldown countdown effect for Resend OTP
  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [resendCooldown]);

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

  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});

  const validateEmailValue = (val: string): string | null => {
    const clean = (val || '').trim();
    if (!clean) return 'Official email address is required.';
    const atMatches = clean.match(/@/g);
    if (!atMatches || atMatches.length === 0) return 'Email must contain "@" (e.g. name@gmail.com).';
    if (atMatches.length > 1) return 'Invalid email: multiple "@" symbols detected.';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clean)) return 'Invalid email format (e.g. name@gmail.com).';
    return null;
  };

  const validateNameValue = (val: string, label: string = 'Name'): string | null => {
    const clean = (val || '').trim();
    if (!clean) return `${label} is required.`;
    if (clean.length < 3) return `${label} must be at least 3 letters.`;
    return null;
  };

  const validateMobileValue = (val: string): string | null => {
    const clean = (val || '').trim().replace(/\D/g, '');
    if (!clean) return 'Mobile number is required.';
    if (clean.length !== 10) return 'Mobile number must be exactly 10 digits.';
    return null;
  };

  const validateEmail = (val: string): boolean => {
    return validateEmailValue(val) === null;
  };

  const getTargetEmail = (): string => {
    if (activeRole === 'PLAYER') return pEmail.trim().toLowerCase();
    if (activeRole === 'TEAM') return coachEmail.trim().toLowerCase();
    if (activeRole === 'SCORER') return sEmail.trim().toLowerCase();
    return uEmail.trim().toLowerCase();
  };

  const setTargetEmail = (val: string) => {
    const clean = val.trim();
    if (activeRole === 'PLAYER') setPEmail(clean);
    else if (activeRole === 'TEAM') setCoachEmail(clean);
    else if (activeRole === 'SCORER') setSEmail(clean);
    else setUEmail(clean);
  };

  const getTargetName = (): string => {
    if (activeRole === 'PLAYER') return pName.trim();
    if (activeRole === 'TEAM') return coachName.trim();
    if (activeRole === 'SCORER') return sName.trim();
    return uName.trim();
  };

  const switchRole = (role: RegistrationRole) => {
    setActiveRole(role);
    setFieldErrors({});
    setOtpSent(false);
    setOtpCode('');
    setIsEmailVerified(false);
    setIsOtpModalVisible(false);
    setOtpModalError(null);
    setOtpModalSuccess(null);
    setPassword('');
    setConfirmPassword('');
    setStatusMessage(null);
    setStatusType(null);
  };

  // Step 1: Send Email Verification OTP
  const handleSendEmailOtp = async (customEmail?: string, customName?: string) => {
    setStatusMessage(null);
    setStatusType(null);
    setOtpModalError(null);
    setOtpModalSuccess(null);

    const email = (customEmail || popupEmail || getTargetEmail()).trim().toLowerCase();
    const name = (customName || getTargetName()).trim();

    const nameErr = validateNameValue(name, activeRole === 'TEAM' ? 'Coach Name' : 'Full Name');
    const emailErr = validateEmailValue(email);

    const errs: Record<string, string> = {};
    if (nameErr) errs.name = nameErr;
    if (emailErr) errs.email = emailErr;

    if (Object.keys(errs).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...errs }));
      const firstErr = nameErr || emailErr;
      setStatusMessage(firstErr || 'Please correct the errors before proceeding.');
      setStatusType('error');
      setOtpModalError(firstErr || null);
      return;
    }

    setTargetEmail(email);
    setPopupEmail(email);

    setIsSendingOtp(true);
    setStatusMessage(`Sending verification code to ${email}...`);
    setStatusType('info');

    try {
      await ScorerApi.sendRegistrationOtp(email, name, activeRole);
      setOtpSent(true);
      setResendCooldown(30);
      const okMsg = `✓ Verification code sent to ${email}! Enter the 6-digit code below.`;
      setStatusMessage(okMsg);
      setStatusType('success');
      setOtpModalSuccess(okMsg);
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to send OTP. Please check email address and try again.';
      setStatusMessage(errMsg);
      setStatusType('error');
      setOtpModalError(errMsg);
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Open Cricket OTP Popup Modal
  const openOtpModal = async (triggerSend: boolean = true) => {
    const email = getTargetEmail();
    const name = getTargetName();

    const nameErr = validateNameValue(name, activeRole === 'TEAM' ? 'Coach Name' : 'Full Name');
    const emailErr = validateEmailValue(email);

    const errs: Record<string, string> = {};
    if (nameErr) errs.name = nameErr;
    if (emailErr) errs.email = emailErr;

    if (Object.keys(errs).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...errs }));
      return;
    }

    setPopupEmail(email);
    setOtpModalError(null);
    setOtpModalSuccess(null);
    setIsOtpModalVisible(true);

    if (triggerSend && !otpSent) {
      await handleSendEmailOtp(email, name);
    }
  };

  // Step 2: Verify Email OTP
  const handleVerifyEmailOtp = async () => {
    setStatusMessage(null);
    setStatusType(null);
    setOtpModalError(null);
    setOtpModalSuccess(null);

    const email = (popupEmail || getTargetEmail()).trim().toLowerCase();
    const cleanOtp = otpCode.trim();

    if (!cleanOtp) {
      const msg = 'Please enter the 6-digit OTP code.';
      setStatusMessage(msg);
      setStatusType('error');
      setOtpModalError(msg);
      return;
    }

    setIsVerifyingOtp(true);
    try {
      await ScorerApi.verifyRegistrationOtp(email, cleanOtp);
      setIsEmailVerified(true);
      const okMsg = '✓ Email verified successfully! You may now set your password.';
      setStatusMessage(okMsg);
      setStatusType('success');
      setOtpModalSuccess(okMsg);
      setTimeout(() => {
        setIsOtpModalVisible(false);
      }, 1000);
    } catch (err: any) {
      const errMsg = err?.message || 'Invalid or expired OTP code.';
      setStatusMessage(errMsg);
      setStatusType('error');
      setOtpModalError(errMsg);
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

    const nameErr = validateNameValue(name, 'Player Full Name');
    const emailErr = validateEmailValue(email);
    const mobileErr = validateMobileValue(mobile);
    let talukErr: string | null = null;
    if (pTaluk === 'Other' && !targetTaluk) talukErr = 'Please enter your Taluk name.';

    const errs: Record<string, string> = {};
    if (nameErr) errs.name = nameErr;
    if (emailErr) errs.email = emailErr;
    if (mobileErr) errs.mobile = mobileErr;
    if (talukErr) errs.taluk = talukErr;

    if (Object.keys(errs).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...errs }));
      return;
    }

    if (!isEmailVerified) {
      openOtpModal(true);
      return;
    }

    if (!password || password.length < 4) {
      setFieldErrors((prev) => ({ ...prev, password: 'Password must be at least 4 characters.' }));
      return;
    }
    if (password !== confirmPassword) {
      setFieldErrors((prev) => ({ ...prev, confirmPassword: 'Passwords do not match.' }));
      return;
    }
    if (!pAgreed) {
      setFieldErrors((prev) => ({ ...prev, agree: 'Please accept the declaration to submit player registration.' }));
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

      await showSuccess(
        'Registration Complete!',
        `Welcome ${name}! Your account has been registered. You can now log in.`,
        2200
      );
      navigate('Login', { initialRole: 'PLAYER' });
    } catch (err: any) {
      setIsLoading(false);
      setStatusMessage(err?.message || 'Player registration failed. Please try again.');
      setStatusType('error');
    }
  };

  // 2. Team Squad Helpers & Submission
  const handleAddPlayer = () => {
    setStatusMessage(null);
    setStatusType(null);

    const name = squadPlayerName.trim();
    const email = squadPlayerEmail.trim().toLowerCase();
    const role = squadPlayerRole.trim() || 'Batter';

    const nameErr = validateNameValue(name, 'Squad Player Name');
    const emailErr = validateEmailValue(email);
    const errs: Record<string, string> = {};
    if (nameErr) errs.squadPlayerName = nameErr;
    if (emailErr) errs.squadPlayerEmail = emailErr;

    if (coachEmail.trim() && email === coachEmail.trim().toLowerCase()) {
      errs.squadPlayerEmail = `Player email cannot be identical to Coach Email.`;
    }
    if (players.some((p) => p.email.toLowerCase() === email)) {
      errs.squadPlayerEmail = `Player with email "${email}" already added to squad.`;
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...errs }));
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
    setFieldErrors((prev) => ({ ...prev, squad: undefined, squadPlayerName: undefined, squadPlayerEmail: undefined }));

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
    setStatusMessage('⚡ Sample squad loaded! Coach details and all 15 squad players added.');
    setStatusType('success');
  };

  const handleTeamSubmit = async () => {
    setStatusMessage(null);
    setStatusType(null);

    const targetTaluk = teamTaluk === 'Other' ? teamCustomTaluk.trim() : teamTaluk;

    const teamNameErr = validateNameValue(teamName, 'Team Name');
    const coachNameErr = validateNameValue(coachName, 'Coach Name');
    const coachEmailErr = validateEmailValue(coachEmail);
    let talukErr: string | null = null;
    if (teamTaluk === 'Other' && !targetTaluk) talukErr = 'Please enter your team Taluk name.';

    const errs: Record<string, string> = {};
    if (teamNameErr) errs.teamName = teamNameErr;
    if (coachNameErr) errs.name = coachNameErr;
    if (coachEmailErr) errs.email = coachEmailErr;
    if (talukErr) errs.taluk = talukErr;

    if (Object.keys(errs).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...errs }));
      return;
    }

    if (!isEmailVerified) {
      openOtpModal(true);
      return;
    }

    if (!password || password.length < 4) {
      setFieldErrors((prev) => ({ ...prev, password: 'Password must be at least 4 characters.' }));
      return;
    }
    if (password !== confirmPassword) {
      setFieldErrors((prev) => ({ ...prev, confirmPassword: 'Passwords do not match.' }));
      return;
    }
    if (players.length === 0) {
      setFieldErrors((prev) => ({ ...prev, squad: 'Please add at least one squad player to your team.' }));
      setStatusMessage('Please add at least one squad player to your team.');
      setStatusType('error');
      return;
    }
    if (!teamAgreed) {
      setFieldErrors((prev) => ({ ...prev, agree: 'Please accept the team declaration.' }));
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
      const teamNotice = `Team "${teamName.trim()}" registration is PENDING Admin approval.\nOnce approved by District Administrator, Coach ${coachName} can log in with password.`;
      setStatusMessage(resp?.message || teamNotice);
      setStatusType('success');

      await showSuccess('Registration Request Submitted!', teamNotice, 3500);
      navigate('Login', { initialRole: 'TEAM' });
    } catch (err: any) {
      setIsLoading(false);
      setStatusMessage(err?.message || 'Team registration failed. Please try again.');
      setStatusType('error');
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

    const nameErr = validateNameValue(name, 'Scorer Full Name');
    const emailErr = validateEmailValue(email);
    const mobileErr = validateMobileValue(mobile);
    let talukErr: string | null = null;
    if (sTaluk === 'Other' && !targetTaluk) talukErr = 'Please enter your Taluk name.';

    const errs: Record<string, string> = {};
    if (nameErr) errs.name = nameErr;
    if (emailErr) errs.email = emailErr;
    if (mobileErr) errs.mobile = mobileErr;
    if (talukErr) errs.taluk = talukErr;

    if (Object.keys(errs).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...errs }));
      return;
    }

    if (!isEmailVerified) {
      openOtpModal(true);
      return;
    }

    if (!password || password.length < 4) {
      setFieldErrors((prev) => ({ ...prev, password: 'Password must be at least 4 characters.' }));
      return;
    }
    if (password !== confirmPassword) {
      setFieldErrors((prev) => ({ ...prev, confirmPassword: 'Passwords do not match.' }));
      return;
    }
    if (!sAgreed) {
      setFieldErrors((prev) => ({ ...prev, agree: 'Please accept the declaration to proceed.' }));
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
      const scorerNotice = `Welcome ${name}! Your scorer registration request is PENDING Admin approval.\nOnce approved by District Administrator, you can log in with your credentials.`;
      setStatusMessage(resp?.message || scorerNotice);
      setStatusType('success');

      setPendingApprovalData({
        name,
        email,
        role: 'Official Scorer',
        certificationLevel: sLevel,
        taluk: targetTaluk
      });
      setShowApprovalPendingModal(true);
    } catch (err: any) {
      setIsLoading(false);
      setStatusMessage(err?.message || 'Scorer registration failed. Please try again.');
      setStatusType('error');
    }
  };

  // 4. Submit Umpire Registration
  const handleUmpireSubmit = async () => {
    setStatusMessage(null);
    setStatusType(null);

    const name = uName.trim();
    const email = uEmail.trim().toLowerCase();
    const targetDistrict = uDistrict === 'Other' ? uCustomDistrict.trim() : uDistrict;

    const nameErr = validateNameValue(name, 'Umpire Full Name');
    const emailErr = validateEmailValue(email);
    const mobileErr = validateMobileValue(uMobile);
    let expErr: string | null = null;
    if (!uExperience.trim()) expErr = 'Please enter Umpire Experience.';
    let distErr: string | null = null;
    if (uDistrict === 'Other' && !targetDistrict) distErr = 'Please specify your District name.';

    const errs: Record<string, string> = {};
    if (nameErr) errs.name = nameErr;
    if (emailErr) errs.email = emailErr;
    if (mobileErr) errs.mobile = mobileErr;
    if (expErr) errs.experience = expErr;
    if (distErr) errs.district = distErr;

    if (Object.keys(errs).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...errs }));
      return;
    }

    if (!isEmailVerified) {
      openOtpModal(true);
      return;
    }

    if (!password || password.length < 4) {
      setFieldErrors((prev) => ({ ...prev, password: 'Password must be at least 4 characters.' }));
      return;
    }
    if (password !== confirmPassword) {
      setFieldErrors((prev) => ({ ...prev, confirmPassword: 'Passwords do not match.' }));
      return;
    }
    if (!uAgreed) {
      setFieldErrors((prev) => ({ ...prev, agree: 'Please accept the declaration to proceed.' }));
      return;
    }

    setIsLoading(true);
    setStatusMessage('Submitting Official Umpire Registration...');
    setStatusType('info');

    try {
      const resp = await ScorerApi.registerUmpire({
        name,
        email,
        mobile: uMobile.trim().replace(/\D/g, '') || undefined,
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
      const umpireNotice = `Welcome ${name}!\nYour Umpire Registration is PENDING Admin approval.\nOnce approved by District Administrator, you can log in with your credentials.`;
      setStatusMessage(resp?.message || umpireNotice);
      setStatusType('success');

      setPendingApprovalData({
        name,
        email,
        role: 'Official Umpire',
        certificationLevel: uQualification,
        taluk: targetDistrict
      });
      setShowApprovalPendingModal(true);
    } catch (err: any) {
      setIsLoading(false);
      setStatusMessage(err?.message || 'Umpire registration failed. Please try again.');
      setStatusType('error');
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
              onPress={() => openOtpModal(true)}
              disabled={isSendingOtp}
            >
              {isSendingOtp ? (
                <ActivityIndicator color="#000000" size="small" />
              ) : (
                <Text style={styles.actionText}>
                  {otpSent ? '🏏 Resend / Enter OTP in Popup' : '🏏 Send Verification OTP to Email'}
                </Text>
              )}
            </TouchableOpacity>

            {otpSent && (
              <View style={{ marginTop: 6 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TextInput
                    style={[styles.input, { flex: 1, textAlign: 'center', letterSpacing: 4, fontWeight: 'bold', fontSize: 14, marginBottom: 0 }]}
                    placeholder="123456"
                    placeholderTextColor="#94a3b8"
                    value={otpCode}
                    onChangeText={setOtpCode}
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
                  <TouchableOpacity
                    style={[styles.verifyBtn, { backgroundColor: '#1e293b' }]}
                    onPress={() => openOtpModal(false)}
                  >
                    <Text style={[styles.verifyBtnText, { color: '#eab308' }]}>Popup</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.verifiedCard}>
            <Text style={styles.verifiedCardText}>✓ Email Verified: {getTargetEmail()}</Text>
          </View>
        )}

        {isEmailVerified && (
          <View style={{ marginTop: 6 }}>
            <View style={styles.formRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Password (min 4 chars) *</Text>
                <View style={[styles.passwordContainer, fieldErrors.password && styles.inputError]}>
                  <TextInput
                    style={styles.passwordInput}
                    value={password}
                    onChangeText={(val) => {
                      setPassword(val);
                      setFieldErrors((prev) => ({ ...prev, password: val.length >= 4 ? undefined : 'Password must be at least 4 characters.' }));
                    }}
                    secureTextEntry={!showPassword}
                    placeholder="Enter password"
                    placeholderTextColor="#94a3b8"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Text style={styles.toggleText}>{showPassword ? '👁️' : '🔒'}</Text>
                  </TouchableOpacity>
                </View>
                {fieldErrors.password && (
                  <Text style={styles.fieldErrorText}>⚠️ {fieldErrors.password}</Text>
                )}
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Confirm Password *</Text>
                <TextInput
                  style={[styles.input, { marginBottom: 0 }, fieldErrors.confirmPassword && styles.inputError]}
                  value={confirmPassword}
                  onChangeText={(val) => {
                    setConfirmPassword(val);
                    setFieldErrors((prev) => ({ ...prev, confirmPassword: val === password ? undefined : 'Passwords do not match.' }));
                  }}
                  secureTextEntry={!showPassword}
                  placeholder="Re-enter password"
                  placeholderTextColor="#94a3b8"
                />
                {fieldErrors.confirmPassword && (
                  <Text style={styles.fieldErrorText}>⚠️ {fieldErrors.confirmPassword}</Text>
                )}
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, Platform.OS === 'web' && isDesktop && ({ height: '100vh', maxHeight: '100vh', overflow: 'hidden' } as any)]}>
        {/* Sleek Minimal Corner Exit Action */}
        <TouchableOpacity
          onPress={() => (onExit ? onExit() : navigate('Home'))}
          style={styles.cornerExitBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.cornerExitText}>← Exit to Main</Text>
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={[styles.scroll, isDesktop && { flex: 1, justifyContent: 'center' }]}
          scrollEnabled={!isDesktop}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.cardContainer}>
            {/* Federation Logo & Title */}
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
              {/* Compact Card Header: Title + Role Tabs */}
              <View style={styles.cardTopRow}>
                <View>
                  <Text style={styles.title}>Register Here</Text>
                  <Text style={styles.subtitle}>District player, team, scorer and umpire enrollment</Text>
                </View>

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
              </View>

              {/* Status Banner */}
              {statusMessage && (
                <View
                  style={[
                    styles.statusBanner,
                    statusType === 'error' && styles.statusError,
                    statusType === 'success' && styles.statusSuccess,
                    statusType === 'info' && styles.statusInfo
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      statusType === 'error' && styles.statusTextError,
                      statusType === 'success' && styles.statusTextSuccess,
                      statusType === 'info' && styles.statusTextInfo
                    ]}
                  >
                    {statusMessage}
                  </Text>
                </View>
              )}

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
                        style={[styles.input, fieldErrors.name && styles.inputError]}
                        value={pName}
                        onChangeText={(val) => {
                          setPName(val);
                          const err = validateNameValue(val, 'Player Name');
                          setFieldErrors((prev) => ({ ...prev, name: err || undefined }));
                        }}
                        placeholder="e.g. R. Saravanan"
                        placeholderTextColor="#94a3b8"
                        autoCapitalize="words"
                      />
                      {fieldErrors.name && (
                        <Text style={styles.fieldErrorText}>⚠️ {fieldErrors.name}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Mobile Number (10 Digits) *</Text>
                      <TextInput
                        style={[styles.input, fieldErrors.mobile && styles.inputError]}
                        value={pMobile}
                        onChangeText={(val) => {
                          setPMobile(val);
                          const err = validateMobileValue(val);
                          setFieldErrors((prev) => ({ ...prev, mobile: err || undefined }));
                        }}
                        placeholder="e.g. 9876543210"
                        keyboardType="phone-pad"
                        placeholderTextColor="#94a3b8"
                        maxLength={10}
                      />
                      {fieldErrors.mobile && (
                        <Text style={styles.fieldErrorText}>⚠️ {fieldErrors.mobile}</Text>
                      )}
                    </View>
                  </View>

                  {/* Row 2: Player Email Address */}
                  <View style={styles.formRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Player Email Address *</Text>
                      <TextInput
                        style={[styles.input, fieldErrors.email && styles.inputError]}
                        value={pEmail}
                        onChangeText={(val) => {
                          setPEmail(val);
                          const err = validateEmailValue(val);
                          setFieldErrors((prev) => ({ ...prev, email: err || undefined }));
                        }}
                        placeholder="e.g. saravanan@example.com"
                        keyboardType="email-address"
                        placeholderTextColor="#94a3b8"
                        autoCapitalize="none"
                      />
                      {fieldErrors.email && (
                        <Text style={styles.fieldErrorText}>⚠️ {fieldErrors.email}</Text>
                      )}
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
                        setFieldErrors((prev) => ({ ...prev, taluk: undefined }));
                      }}
                    />
                  </View>

                  {/* Custom Taluk Input if "Other" is chosen */}
                  {pTaluk === 'Other' && (
                    <View style={styles.formRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Specify Taluk Name *</Text>
                        <TextInput
                          style={[styles.input, fieldErrors.taluk && styles.inputError]}
                          value={pCustomTaluk}
                          onChangeText={(val) => {
                            setPCustomTaluk(val);
                            setFieldErrors((prev) => ({ ...prev, taluk: val.trim() ? undefined : 'Please enter your Taluk name.' }));
                          }}
                          placeholder="Type your taluk name here..."
                          placeholderTextColor="#94a3b8"
                          autoCapitalize="words"
                        />
                        {fieldErrors.taluk && (
                          <Text style={styles.fieldErrorText}>⚠️ {fieldErrors.taluk}</Text>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Verification & Password Setup */}
                  {renderVerificationAndPasswordBlock()}

                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => {
                      const next = !pAgreed;
                      setPAgreed(next);
                      setFieldErrors((prev) => ({ ...prev, agree: next ? undefined : 'Please accept the declaration to proceed.' }));
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
                  {fieldErrors.agree && (
                    <Text style={[styles.fieldErrorText, { marginTop: -4, marginBottom: 6 }]}>⚠️ {fieldErrors.agree}</Text>
                  )}

                  <TouchableOpacity
                    style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
                    onPress={handlePlayerSubmit}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#000000" size="small" />
                    ) : (
                      <Text style={styles.submitBtnText}>
                        {isEmailVerified ? 'Submit Player Registration' : 'Verify Email & Submit Registration'}
                      </Text>
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
                        onChangeText={(val) => {
                          setTeamName(val);
                          const err = validateNameValue(val, 'Team Name');
                          setFieldErrors((prev) => ({ ...prev, teamName: err || undefined }));
                        }}
                        placeholder="e.g. Sivakasi Super Strikers"
                        placeholderTextColor="#94a3b8"
                      />
                      {fieldErrors.teamName && (
                        <Text style={styles.fieldErrorText}>⚠️ {fieldErrors.teamName}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Head Coach / Manager Name *</Text>
                      <TextInput
                        style={[styles.input, fieldErrors.name && styles.inputError]}
                        value={coachName}
                        onChangeText={(val) => {
                          setCoachName(val);
                          const err = validateNameValue(val, 'Coach Name');
                          setFieldErrors((prev) => ({ ...prev, name: err || undefined }));
                        }}
                        placeholder="e.g. Coach S. Murugan"
                        placeholderTextColor="#94a3b8"
                      />
                      {fieldErrors.name && (
                        <Text style={styles.fieldErrorText}>⚠️ {fieldErrors.name}</Text>
                      )}
                    </View>
                  </View>

                  {/* Row 2: Coach Email (left) & Team Taluk (right) */}
                  <View style={styles.formRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Coach Official Email Address *</Text>
                      <TextInput
                        style={[styles.input, fieldErrors.email && styles.inputError]}
                        value={coachEmail}
                        onChangeText={(val) => {
                          setCoachEmail(val);
                          const err = validateEmailValue(val);
                          setFieldErrors((prev) => ({ ...prev, email: err || undefined }));
                        }}
                        placeholder="e.g. coach@strikerscc.org"
                        keyboardType="email-address"
                        placeholderTextColor="#94a3b8"
                        autoCapitalize="none"
                      />
                      {fieldErrors.email && (
                        <Text style={styles.fieldErrorText}>⚠️ {fieldErrors.email}</Text>
                      )}
                    </View>
                    <DropdownField
                      label="Team Taluk Jurisdiction"
                      value={teamTaluk}
                      options={TALUK_OPTIONS}
                      onSelect={(val) => {
                        setTeamTaluk(val);
                        if (val !== 'Other') setTeamCustomTaluk('');
                        setFieldErrors((prev) => ({ ...prev, taluk: undefined }));
                      }}
                    />
                  </View>

                  {/* Custom Taluk Input if "Other" is chosen */}
                  {teamTaluk === 'Other' && (
                    <View style={styles.formRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Specify Team Taluk Name *</Text>
                        <TextInput
                          style={[styles.input, fieldErrors.taluk && styles.inputError]}
                          value={teamCustomTaluk}
                          onChangeText={(val) => {
                            setTeamCustomTaluk(val);
                            setFieldErrors((prev) => ({ ...prev, taluk: val.trim() ? undefined : 'Please enter your team Taluk name.' }));
                          }}
                          placeholder="Type your team's taluk name here..."
                          placeholderTextColor="#94a3b8"
                          autoCapitalize="words"
                        />
                        {fieldErrors.taluk && (
                          <Text style={styles.fieldErrorText}>⚠️ {fieldErrors.taluk}</Text>
                        )}
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
                          onChangeText={(val) => {
                            setSquadPlayerName(val);
                            const err = validateNameValue(val, 'Squad Player Name');
                            setFieldErrors((prev) => ({ ...prev, squadPlayerName: err || undefined }));
                          }}
                          placeholder="Player Full Name"
                          placeholderTextColor="#94a3b8"
                        />
                        {fieldErrors.squadPlayerName && (
                          <Text style={styles.fieldErrorText}>⚠️ {fieldErrors.squadPlayerName}</Text>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <TextInput
                          style={[styles.input, { marginBottom: 0 }, fieldErrors.squadPlayerEmail && styles.inputError]}
                          value={squadPlayerEmail}
                          onChangeText={(val) => {
                            setSquadPlayerEmail(val);
                            const err = validateEmailValue(val);
                            setFieldErrors((prev) => ({ ...prev, squadPlayerEmail: err || undefined }));
                          }}
                          placeholder="Player Email Address"
                          keyboardType="email-address"
                          placeholderTextColor="#94a3b8"
                          autoCapitalize="none"
                        />
                        {fieldErrors.squadPlayerEmail && (
                          <Text style={styles.fieldErrorText}>⚠️ {fieldErrors.squadPlayerEmail}</Text>
                        )}
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
                  {fieldErrors.squad && (
                    <Text style={[styles.fieldErrorText, { marginBottom: 6 }]}>⚠️ {fieldErrors.squad}</Text>
                  )}

                  {/* Verification & Password Setup */}
                  {renderVerificationAndPasswordBlock()}

                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => {
                      const next = !teamAgreed;
                      setTeamAgreed(next);
                      setFieldErrors((prev) => ({ ...prev, agree: next ? undefined : 'Please accept the declaration to proceed.' }));
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
                  {fieldErrors.agree && (
                    <Text style={[styles.fieldErrorText, { marginTop: -4, marginBottom: 6 }]}>⚠️ {fieldErrors.agree}</Text>
                  )}

                  <TouchableOpacity
                    style={[styles.submitBtn, (players.length === 0 || isLoading) && styles.submitBtnDisabled]}
                    onPress={handleTeamSubmit}
                    disabled={players.length === 0 || isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#000000" size="small" />
                    ) : (
                      <Text style={styles.submitBtnText}>
                        {isEmailVerified ? 'Submit Team & Coach Registration' : 'Verify Email & Submit Registration'}
                      </Text>
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
                        style={[styles.input, fieldErrors.name && styles.inputError]}
                        value={sName}
                        onChangeText={(val) => {
                          setSName(val);
                          const err = validateNameValue(val, 'Scorer Name');
                          setFieldErrors((prev) => ({ ...prev, name: err || undefined }));
                        }}
                        placeholder="e.g. S. Ramesh"
                        placeholderTextColor="#94a3b8"
                        autoCapitalize="words"
                      />
                      {fieldErrors.name && (
                        <Text style={styles.fieldErrorText}>⚠️ {fieldErrors.name}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Mobile Number *</Text>
                      <TextInput
                        style={[styles.input, fieldErrors.mobile && styles.inputError]}
                        value={sMobile}
                        onChangeText={(val) => {
                          setSMobile(val);
                          const err = validateMobileValue(val);
                          setFieldErrors((prev) => ({ ...prev, mobile: err || undefined }));
                        }}
                        placeholder="e.g. 9876543210"
                        keyboardType="phone-pad"
                        placeholderTextColor="#94a3b8"
                        maxLength={10}
                      />
                      {fieldErrors.mobile && (
                        <Text style={styles.fieldErrorText}>⚠️ {fieldErrors.mobile}</Text>
                      )}
                    </View>
                  </View>

                  {/* Row 2: Official Scorer Email */}
                  <View style={styles.formRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Official Scorer Email *</Text>
                      <TextInput
                        style={[styles.input, fieldErrors.email && styles.inputError]}
                        value={sEmail}
                        onChangeText={(val) => {
                          setSEmail(val);
                          const err = validateEmailValue(val);
                          setFieldErrors((prev) => ({ ...prev, email: err || undefined }));
                        }}
                        placeholder="e.g. ramesh.scorer@cfvd.org"
                        keyboardType="email-address"
                        placeholderTextColor="#94a3b8"
                        autoCapitalize="none"
                      />
                      {fieldErrors.email && (
                        <Text style={styles.fieldErrorText}>⚠️ {fieldErrors.email}</Text>
                      )}
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
                        setFieldErrors((prev) => ({ ...prev, taluk: undefined }));
                      }}
                    />
                  </View>

                  {/* Custom Taluk Input if "Other" is chosen */}
                  {sTaluk === 'Other' && (
                    <View style={styles.formRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Specify Scorer Taluk Name *</Text>
                        <TextInput
                          style={[styles.input, fieldErrors.taluk && styles.inputError]}
                          value={sCustomTaluk}
                          onChangeText={(val) => {
                            setSCustomTaluk(val);
                            setFieldErrors((prev) => ({ ...prev, taluk: val.trim() ? undefined : 'Please enter your Taluk name.' }));
                          }}
                          placeholder="Type your taluk name here..."
                          placeholderTextColor="#94a3b8"
                          autoCapitalize="words"
                        />
                        {fieldErrors.taluk && (
                          <Text style={styles.fieldErrorText}>⚠️ {fieldErrors.taluk}</Text>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Verification & Password Setup */}
                  {renderVerificationAndPasswordBlock()}

                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => {
                      const next = !sAgreed;
                      setSAgreed(next);
                      setFieldErrors((prev) => ({ ...prev, agree: next ? undefined : 'Please accept the declaration to proceed.' }));
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
                  {fieldErrors.agree && (
                    <Text style={[styles.fieldErrorText, { marginTop: -4, marginBottom: 6 }]}>⚠️ {fieldErrors.agree}</Text>
                  )}

                  <TouchableOpacity
                    style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
                    onPress={handleScorerSubmit}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#000000" size="small" />
                    ) : (
                      <Text style={styles.submitBtnText}>
                        {isEmailVerified ? 'Submit Scorer Registration' : 'Verify Email & Submit Registration'}
                      </Text>
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

                  {/* Row 1: Umpire Full Name (left) & Mobile Number (right) */}
                  <View style={styles.formRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Umpire Full Name *</Text>
                      <TextInput
                        style={[styles.input, fieldErrors.name && styles.inputError]}
                        value={uName}
                        onChangeText={(val) => {
                          setUName(val);
                          const err = validateNameValue(val, 'Umpire Name');
                          setFieldErrors((prev) => ({ ...prev, name: err || undefined }));
                        }}
                        placeholder="e.g. K. Sundararajan"
                        placeholderTextColor="#94a3b8"
                        autoCapitalize="words"
                      />
                      {fieldErrors.name && (
                        <Text style={styles.fieldErrorText}>⚠️ {fieldErrors.name}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Mobile Number (10 Digits) *</Text>
                      <TextInput
                        style={[styles.input, fieldErrors.mobile && styles.inputError]}
                        value={uMobile}
                        onChangeText={(val) => {
                          setUMobile(val);
                          const err = validateMobileValue(val);
                          setFieldErrors((prev) => ({ ...prev, mobile: err || undefined }));
                        }}
                        placeholder="e.g. 9876543210"
                        keyboardType="phone-pad"
                        placeholderTextColor="#94a3b8"
                        maxLength={10}
                      />
                      {fieldErrors.mobile && (
                        <Text style={styles.fieldErrorText}>⚠️ {fieldErrors.mobile}</Text>
                      )}
                    </View>
                  </View>

                  {/* Row 2: Official Umpire Email */}
                  <View style={styles.formRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Official Umpire Email *</Text>
                      <TextInput
                        style={[styles.input, fieldErrors.email && styles.inputError]}
                        value={uEmail}
                        onChangeText={(val) => {
                          setUEmail(val);
                          const err = validateEmailValue(val);
                          setFieldErrors((prev) => ({ ...prev, email: err || undefined }));
                        }}
                        placeholder="e.g. sundararajan.umpire@cfvd.org"
                        keyboardType="email-address"
                        placeholderTextColor="#94a3b8"
                        autoCapitalize="none"
                      />
                      {fieldErrors.email && (
                        <Text style={styles.fieldErrorText}>⚠️ {fieldErrors.email}</Text>
                      )}
                    </View>
                  </View>

                  {/* Row 3: Certification/Qualification & Umpire Experience */}
                  <View style={styles.formRow}>
                    <DropdownField
                      label="Umpire Certification / Qualification *"
                      value={uQualification}
                      options={UMPIRE_QUALIFICATIONS}
                      onSelect={setUQualification}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Umpire Experience *</Text>
                      <TextInput
                        style={[styles.input, fieldErrors.experience && styles.inputError]}
                        value={uExperience}
                        onChangeText={(val) => {
                          setUExperience(val);
                          setFieldErrors((prev) => ({ ...prev, experience: val.trim() ? undefined : 'Please enter Umpire Experience.' }));
                        }}
                        placeholder="e.g. 6 Years / Senior Panel"
                        placeholderTextColor="#94a3b8"
                      />
                      {fieldErrors.experience && (
                        <Text style={styles.fieldErrorText}>⚠️ {fieldErrors.experience}</Text>
                      )}
                    </View>
                  </View>

                  {/* Row 4: District & State */}
                  <View style={styles.formRow}>
                    <DropdownField
                      label="District *"
                      value={uDistrict}
                      options={DISTRICT_OPTIONS}
                      onSelect={(val) => {
                        setUDistrict(val);
                        if (val !== 'Other') setUCustomDistrict('');
                        setFieldErrors((prev) => ({ ...prev, district: undefined }));
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
                          style={[styles.input, fieldErrors.district && styles.inputError]}
                          value={uCustomDistrict}
                          onChangeText={(val) => {
                            setUCustomDistrict(val);
                            setFieldErrors((prev) => ({ ...prev, district: val.trim() ? undefined : 'Please specify your District name.' }));
                          }}
                          placeholder="Type your district name here..."
                          placeholderTextColor="#94a3b8"
                          autoCapitalize="words"
                        />
                        {fieldErrors.district && (
                          <Text style={styles.fieldErrorText}>⚠️ {fieldErrors.district}</Text>
                        )}
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
                      const next = !uAgreed;
                      setUAgreed(next);
                      setFieldErrors((prev) => ({ ...prev, agree: next ? undefined : 'Please accept the declaration to proceed.' }));
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
                  {fieldErrors.agree && (
                    <Text style={[styles.fieldErrorText, { marginTop: -4, marginBottom: 6 }]}>⚠️ {fieldErrors.agree}</Text>
                  )}

                  <TouchableOpacity
                    style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
                    onPress={handleUmpireSubmit}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#000000" size="small" />
                    ) : (
                      <Text style={styles.submitBtnText}>
                        {isEmailVerified ? 'Submit Umpire Registration' : 'Verify Email & Submit Registration'}
                      </Text>
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

        {/* Cricket OTP Popup Modal (Virat Kohli Lord's Theme) */}
        <Modal
          visible={isOtpModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsOtpModalVisible(false)}
        >
          <View style={styles.cricketModalOverlay}>
            <View style={[styles.cricketModalCard, isDesktop ? styles.cricketCardDesktop : styles.cricketCardMobile]}>
              {isDesktop ? (
                <View style={styles.cricketDesktopBg}>
                  {/* Left Side: Virat Kohli Image sent by user */}
                  <View style={styles.cricketHeroImageContainer}>
                    <Image
                      source={require('../../../assets/virat_kohli_otp.png')}
                      style={styles.cricketHeroFullImage}
                      resizeMode="cover"
                    />
                    <View style={styles.cricketHeroTag}>
                      <View style={styles.cricketHeroPill}>
                        <Text style={styles.cricketHeroPillText}>🏏 OFFICIAL REGISTRATION</Text>
                      </View>
                      <Text style={styles.cricketHeroHeading}>CRICKET FEDERATION OF</Text>
                      <Text style={styles.cricketHeroSubheading}>VIRUDHUNAGAR DISTRICT</Text>
                    </View>
                  </View>

                  {/* Right Side Space: Email + OTP + Verify */}
                  <View style={styles.cricketRightPanel}>
                    <View style={styles.popupTopBar}>
                      <View>
                        <Text style={styles.popupTag}>SECURE VERIFICATION</Text>
                        <Text style={styles.popupTitle}>Email OTP Verification</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setIsOtpModalVisible(false)}
                        style={styles.popupCloseCircle}
                      >
                        <Text style={styles.popupCloseX}>✕</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.popupExplainer}>
                      We have dispatched a 6-digit verification OTP to your registered email address below. Enter it to verify:
                    </Text>

                    {/* Email Display & Edit Input */}
                    <View style={styles.popupInputGroup}>
                      <Text style={styles.popupInputLabel}>REGISTERED EMAIL ADDRESS</Text>
                      <View style={styles.popupEmailRow}>
                        <Text style={styles.popupEmailIcon}>✉️</Text>
                        <TextInput
                          style={styles.popupEmailInput}
                          value={popupEmail}
                          onChangeText={(val) => {
                            setPopupEmail(val);
                            setTargetEmail(val);
                          }}
                          placeholder="your.email@example.com"
                          placeholderTextColor="#94a3b8"
                          keyboardType="email-address"
                          autoCapitalize="none"
                        />
                      </View>
                    </View>

                    {/* OTP 6-Digit Input */}
                    <View style={styles.popupInputGroup}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={styles.popupInputLabel}>ENTER 6-DIGIT OTP</Text>
                        <Text style={styles.popupExpiryBadge}>Valid for 10 min</Text>
                      </View>
                      <TextInput
                        style={styles.popupOtpBox}
                        value={otpCode}
                        onChangeText={(val) => setOtpCode(val.replace(/\D/g, '').slice(0, 6))}
                        placeholder="• • • • • •"
                        placeholderTextColor="#475569"
                        keyboardType="number-pad"
                        maxLength={6}
                        autoFocus
                      />
                    </View>

                    {otpModalError && (
                      <View style={styles.popupErrorBox}>
                        <Text style={styles.popupErrorMsg}>⚠️ {otpModalError}</Text>
                        {otpModalError.includes('already registered') && (
                          <TouchableOpacity
                            style={{ marginTop: 8, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: '#f59e0b', borderRadius: 8, alignItems: 'center' }}
                            onPress={() => {
                              setIsOtpModalVisible(false);
                              navigate('Login', { initialRole: activeRole });
                            }}
                          >
                            <Text style={{ color: '#000000', fontWeight: '800', fontSize: 12 }}>Proceed to Login Screen ➔</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                    {otpModalSuccess && (
                      <View style={styles.popupSuccessBox}>
                        <Text style={styles.popupSuccessMsg}>{otpModalSuccess}</Text>
                      </View>
                    )}

                    {/* Verify Action Button */}
                    <TouchableOpacity
                      style={[
                        styles.popupVerifyButton,
                        (isVerifyingOtp || !otpCode.trim() || isEmailVerified) && styles.popupBtnDisabled
                      ]}
                      onPress={handleVerifyEmailOtp}
                      disabled={isVerifyingOtp || !otpCode.trim() || isEmailVerified}
                      activeOpacity={0.85}
                    >
                      {isVerifyingOtp ? (
                        <ActivityIndicator color="#000000" size="small" />
                      ) : (
                        <Text style={styles.popupVerifyButtonText}>
                          {isEmailVerified ? '✓ VERIFIED SUCCESSFULLY' : 'VERIFY OTP & CONTINUE ➔'}
                        </Text>
                      )}
                    </TouchableOpacity>

                    {/* Footer: Resend & Help */}
                    <View style={styles.popupFooter}>
                      <Text style={styles.popupFooterText}>Didn't receive the OTP?</Text>
                      <TouchableOpacity
                        disabled={isSendingOtp || resendCooldown > 0}
                        onPress={() => handleSendEmailOtp()}
                      >
                        <Text
                          style={[
                            styles.popupResendAction,
                            (isSendingOtp || resendCooldown > 0) && styles.popupResendDisabled
                          ]}
                        >
                          {isSendingOtp
                            ? 'Sending code...'
                            : resendCooldown > 0
                            ? `Resend in ${resendCooldown}s`
                            : 'Resend OTP ↻'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ) : (
                /* Mobile Layout */
                <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
                  <View style={styles.mobileHeroImageWrap}>
                    <Image
                      source={require('../../../assets/virat_kohli_otp.png')}
                      style={styles.mobileHeroImage}
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      onPress={() => setIsOtpModalVisible(false)}
                      style={styles.mobileCloseCircle}
                    >
                      <Text style={styles.popupCloseX}>✕</Text>
                    </TouchableOpacity>
                    <View style={styles.mobileHeroOverlayTag}>
                      <Text style={styles.cricketHeroPillText}>🏏 CFVD CRICKET</Text>
                    </View>
                  </View>

                  <View style={styles.mobileFormBody}>
                    <Text style={styles.popupTag}>SECURE VERIFICATION</Text>
                    <Text style={styles.popupTitle}>Email OTP Verification</Text>
                    <Text style={styles.popupExplainer}>
                      We have sent a 6-digit verification code to your email. Enter below to verify:
                    </Text>

                    <View style={styles.popupInputGroup}>
                      <Text style={styles.popupInputLabel}>REGISTERED EMAIL ADDRESS</Text>
                      <View style={styles.popupEmailRow}>
                        <Text style={styles.popupEmailIcon}>✉️</Text>
                        <TextInput
                          style={styles.popupEmailInput}
                          value={popupEmail}
                          onChangeText={(val) => {
                            setPopupEmail(val);
                            setTargetEmail(val);
                          }}
                          placeholder="your.email@example.com"
                          placeholderTextColor="#94a3b8"
                          keyboardType="email-address"
                          autoCapitalize="none"
                        />
                      </View>
                    </View>

                    <View style={styles.popupInputGroup}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={styles.popupInputLabel}>ENTER 6-DIGIT OTP</Text>
                        <Text style={styles.popupExpiryBadge}>10 min</Text>
                      </View>
                      <TextInput
                        style={styles.popupOtpBox}
                        value={otpCode}
                        onChangeText={(val) => setOtpCode(val.replace(/\D/g, '').slice(0, 6))}
                        placeholder="• • • • • •"
                        placeholderTextColor="#475569"
                        keyboardType="number-pad"
                        maxLength={6}
                      />
                    </View>

                    {otpModalError && (
                      <View style={styles.popupErrorBox}>
                        <Text style={styles.popupErrorMsg}>⚠️ {otpModalError}</Text>
                        {otpModalError.includes('already registered') && (
                          <TouchableOpacity
                            style={{ marginTop: 8, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: '#f59e0b', borderRadius: 8, alignItems: 'center' }}
                            onPress={() => {
                              setIsOtpModalVisible(false);
                              navigate('Login', { initialRole: activeRole });
                            }}
                          >
                            <Text style={{ color: '#000000', fontWeight: '800', fontSize: 12 }}>Proceed to Login Screen ➔</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                    {otpModalSuccess && (
                      <View style={styles.popupSuccessBox}>
                        <Text style={styles.popupSuccessMsg}>{otpModalSuccess}</Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={[
                        styles.popupVerifyButton,
                        (isVerifyingOtp || !otpCode.trim() || isEmailVerified) && styles.popupBtnDisabled
                      ]}
                      onPress={handleVerifyEmailOtp}
                      disabled={isVerifyingOtp || !otpCode.trim() || isEmailVerified}
                      activeOpacity={0.85}
                    >
                      {isVerifyingOtp ? (
                        <ActivityIndicator color="#000000" size="small" />
                      ) : (
                        <Text style={styles.popupVerifyButtonText}>
                          {isEmailVerified ? '✓ VERIFIED' : 'VERIFY OTP & CONTINUE ➔'}
                        </Text>
                      )}
                    </TouchableOpacity>

                    <View style={styles.popupFooter}>
                      <Text style={styles.popupFooterText}>Didn't receive code?</Text>
                      <TouchableOpacity
                        disabled={isSendingOtp || resendCooldown > 0}
                        onPress={() => handleSendEmailOtp()}
                      >
                        <Text
                          style={[
                            styles.popupResendAction,
                            (isSendingOtp || resendCooldown > 0) && styles.popupResendDisabled
                          ]}
                        >
                          {isSendingOtp
                            ? 'Sending...'
                            : resendCooldown > 0
                            ? `Resend in ${resendCooldown}s`
                            : 'Resend OTP ↻'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        {/* ========================================================= */}
        {/* OFFICIAL PENDING ADMIN VERIFICATION POPUP MODAL */}
        {/* ========================================================= */}
        <Modal
          visible={showApprovalPendingModal}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setShowApprovalPendingModal(false);
            navigate('Login', { initialRole: activeRole });
          }}
        >
          <View style={styles.approvalModalOverlay}>
            <View style={[
              styles.approvalModalCard,
              isDesktop ? styles.approvalCardDesktop : styles.approvalCardMobile
            ]}>
              {isDesktop ? (
                /* Desktop 2-Column Side-by-Side Layout */
                <View style={styles.approvalDesktopContainer}>
                  {/* Left Column: Full Virat Kohli HD Celebration Image */}
                  <View style={styles.approvalHeroImageContainer}>
                    <Image
                      source={require('../../../assets/virat_kohli_otp.png')}
                      style={styles.approvalHeroFullImage}
                      resizeMode="cover"
                    />
                    {/* Top Overlay Badge with App Logo */}
                    <View style={styles.approvalHeroTopOverlay}>
                      <Image
                        source={require('../../../assets/logo_transparent.png')}
                        style={styles.approvalAppLogo}
                        resizeMode="contain"
                      />
                      <View>
                        <Text style={styles.approvalFederationName}>CFVD OFFICIAL</Text>
                        <Text style={styles.approvalFederationSub}>CRICKET ASSOCIATION</Text>
                      </View>
                    </View>

                    {/* Bottom Overlay Info */}
                    <View style={styles.approvalHeroBottomOverlay}>
                      <View style={styles.approvalBadgePill}>
                        <Text style={styles.approvalBadgePillText}>🏏 OFFICIAL VERIFICATION</Text>
                      </View>
                      <Text style={styles.approvalHeroTitle}>CRICKET FEDERATION OF</Text>
                      <Text style={styles.approvalHeroSubTitle}>VIRUDHUNAGAR DISTRICT</Text>
                    </View>
                  </View>

                  {/* Right Column: Scrollable Workflow & Verification Details */}
                  <View style={styles.approvalRightPanel}>
                    <ScrollView
                      showsVerticalScrollIndicator={true}
                      contentContainerStyle={styles.approvalRightScrollContent}
                    >
                      {/* Top Bar with Pending Pill & Close X */}
                      <View style={styles.approvalTopBarRow}>
                        <View style={styles.approvalStatusPill}>
                          <Text style={styles.approvalStatusPillText}>⏳ PENDING ADMIN VERIFICATION</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.approvalCloseCircle}
                          onPress={() => {
                            setShowApprovalPendingModal(false);
                            navigate('Login', { initialRole: activeRole });
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.approvalCloseX}>✕</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Header Row */}
                      <View style={styles.approvalHeaderRow}>
                        <View style={styles.approvalIconCircle}>
                          <Text style={styles.approvalIconText}>🛡️</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={styles.approvalMainHeading}>Registration Submitted Successfully!</Text>
                          <Text style={styles.approvalSubHeading}>District Administrator Verification Required</Text>
                        </View>
                      </View>

                      {/* 4-Step Verification Workflow Diagram */}
                      <View style={styles.flowDiagramCard}>
                        <View style={styles.flowDiagramHeader}>
                          <Text style={styles.flowDiagramTitle}>VERIFICATION & ACCESS WORKFLOW</Text>
                          <Text style={styles.flowDiagramSubtitle}>
                            Follow the progress of your {pendingApprovalData?.role ? pendingApprovalData.role.toLowerCase() : 'official'} credentials
                          </Text>
                        </View>

                        <View style={styles.flowStepsContainer}>
                          {/* Step 1 */}
                          <View style={styles.flowStepItem}>
                            <View style={[styles.flowStepIconCircle, styles.flowStepCompleted]}>
                              <Text style={styles.flowStepIcon}>📝</Text>
                              <View style={styles.flowStepCheckBadge}>
                                <Text style={styles.flowStepCheckText}>✓</Text>
                              </View>
                            </View>
                            <Text style={styles.flowStepNum}>STEP 1</Text>
                            <Text style={styles.flowStepLabel}>
                              {pendingApprovalData?.role?.includes('Umpire') ? 'Umpire Registration' : 'Scorer Registration'}
                            </Text>
                            <Text style={styles.flowStepStatusGreen}>Submitted</Text>
                          </View>

                          <View style={styles.flowArrowContainer}>
                            <Text style={styles.flowArrowText}>➔</Text>
                          </View>

                          {/* Step 2 */}
                          <View style={styles.flowStepItem}>
                            <View style={[styles.flowStepIconCircle, styles.flowStepActive]}>
                              <Text style={styles.flowStepIcon}>🛡️</Text>
                              <View style={styles.flowStepWaitBadge}>
                                <Text style={styles.flowStepWaitText}>⏳</Text>
                              </View>
                            </View>
                            <Text style={styles.flowStepNum}>STEP 2</Text>
                            <Text style={styles.flowStepLabel}>Admin Approval</Text>
                            <Text style={styles.flowStepStatusAmber}>In Review</Text>
                          </View>

                          <View style={styles.flowArrowContainer}>
                            <Text style={styles.flowArrowText}>➔</Text>
                          </View>

                          {/* Step 3 */}
                          <View style={styles.flowStepItem}>
                            <View style={[styles.flowStepIconCircle, styles.flowStepUpcoming]}>
                              <Text style={styles.flowStepIcon}>✉️</Text>
                            </View>
                            <Text style={styles.flowStepNum}>STEP 3</Text>
                            <Text style={styles.flowStepLabel}>Email Confirmation</Text>
                            <Text style={styles.flowStepStatusMuted}>Sent to Inbox</Text>
                          </View>

                          <View style={styles.flowArrowContainer}>
                            <Text style={styles.flowArrowText}>➔</Text>
                          </View>

                          {/* Step 4 */}
                          <View style={styles.flowStepItem}>
                            <View style={[styles.flowStepIconCircle, styles.flowStepUpcoming]}>
                              <Text style={styles.flowStepIcon}>🔑</Text>
                            </View>
                            <Text style={styles.flowStepNum}>STEP 4</Text>
                            <Text style={styles.flowStepLabel}>Portal Login</Text>
                            <Text style={styles.flowStepStatusMuted}>
                              {pendingApprovalData?.role?.includes('Umpire') ? 'Access Umpire' : 'Access Scorer'}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Applicant Summary Card */}
                      {pendingApprovalData && (
                        <View style={styles.approvalDetailsCard}>
                          <View style={styles.approvalDetailRow}>
                            <Text style={styles.approvalDetailLabel}>Applicant Name:</Text>
                            <Text style={styles.approvalDetailVal}>{pendingApprovalData.name}</Text>
                          </View>
                          <View style={styles.approvalDetailRow}>
                            <Text style={styles.approvalDetailLabel}>Role / Category:</Text>
                            <Text style={styles.approvalDetailVal}>{pendingApprovalData.role}</Text>
                          </View>
                          {pendingApprovalData.certificationLevel && (
                            <View style={styles.approvalDetailRow}>
                              <Text style={styles.approvalDetailLabel}>Certification Level:</Text>
                              <Text style={[styles.approvalDetailVal, { color: '#f59e0b', fontWeight: '800' }]}>
                                🏅 {pendingApprovalData.certificationLevel}
                              </Text>
                            </View>
                          )}
                          {pendingApprovalData.taluk && (
                            <View style={styles.approvalDetailRow}>
                              <Text style={styles.approvalDetailLabel}>Jurisdiction / Taluk:</Text>
                              <Text style={styles.approvalDetailVal}>{pendingApprovalData.taluk}</Text>
                            </View>
                          )}
                          <View style={styles.approvalDetailRow}>
                            <Text style={styles.approvalDetailLabel}>Registered Email:</Text>
                            <Text style={styles.approvalDetailVal}>{pendingApprovalData.email}</Text>
                          </View>
                        </View>
                      )}

                      {/* Official English Notice Box */}
                      <View style={styles.approvalNoticeBox}>
                        <View style={styles.approvalNoticeHeaderRow}>
                          <Text style={styles.approvalNoticeHeaderIcon}>📢</Text>
                          <Text style={styles.approvalNoticeHeading}>District Administrator Verification Notice</Text>
                        </View>
                        <Text style={styles.approvalNoticeEnglish}>
                          Your registration application and certification documents have been submitted to the District Cricket Administrator (CFVD) for official verification.
                        </Text>
                        <Text style={[styles.approvalNoticeEnglish, { marginTop: 6, color: '#fde047' }]}>
                          Once the Administrator approves your profile, an official confirmation email will be dispatched to <Text style={{ fontWeight: '800' }}>{pendingApprovalData?.email || 'your email'}</Text>. Your account status will be set to ACTIVE, enabling immediate access to the Portal.
                        </Text>
                      </View>

                      {/* Action Button */}
                      <View style={styles.approvalActionRow}>
                        <TouchableOpacity
                          style={styles.approvalPrimaryBtn}
                          onPress={() => {
                            setShowApprovalPendingModal(false);
                            navigate('Login', { initialRole: activeRole });
                          }}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.approvalPrimaryBtnText}>
                            {pendingApprovalData?.role?.includes('Umpire')
                              ? 'Proceed to Umpire Login Portal →'
                              : 'Proceed to Scorer Login Portal →'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </ScrollView>
                  </View>
                </View>
              ) : (
                /* Mobile Single-Column Scrollable Layout */
                <ScrollView
                  showsVerticalScrollIndicator={true}
                  contentContainerStyle={{ flexGrow: 1 }}
                >
                  {/* Top Mobile Hero Banner with Full Image */}
                  <View style={styles.approvalMobileHeroWrap}>
                    <Image
                      source={require('../../../assets/virat_kohli_otp.png')}
                      style={styles.approvalMobileHeroImage}
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      onPress={() => {
                        setShowApprovalPendingModal(false);
                        navigate('Login', { initialRole: activeRole });
                      }}
                      style={styles.approvalMobileCloseCircle}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.approvalCloseX}>✕</Text>
                    </TouchableOpacity>
                    <View style={styles.approvalMobileTopOverlay}>
                      <Image
                        source={require('../../../assets/logo_transparent.png')}
                        style={styles.approvalAppLogo}
                        resizeMode="contain"
                      />
                      <View>
                        <Text style={styles.approvalFederationName}>CFVD OFFICIAL</Text>
                        <Text style={styles.approvalFederationSub}>CRICKET ASSOCIATION</Text>
                      </View>
                    </View>
                    <View style={styles.approvalMobileBottomOverlay}>
                      <View style={styles.approvalBadgePill}>
                        <Text style={styles.approvalBadgePillText}>⏳ PENDING ADMIN VERIFICATION</Text>
                      </View>
                      <Text style={styles.approvalHeroTitleMobile}>CRICKET FEDERATION OF VIRUDHUNAGAR DISTRICT</Text>
                    </View>
                  </View>

                  {/* Body Content */}
                  <View style={styles.approvalBody}>
                    <View style={styles.approvalHeaderRow}>
                      <View style={styles.approvalIconCircle}>
                        <Text style={styles.approvalIconText}>🛡️</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.approvalMainHeading}>Registration Submitted Successfully!</Text>
                        <Text style={styles.approvalSubHeading}>District Administrator Verification Required</Text>
                      </View>
                    </View>

                    {/* 4-Step Verification Workflow Diagram */}
                    <View style={styles.flowDiagramCard}>
                      <View style={styles.flowDiagramHeader}>
                        <Text style={styles.flowDiagramTitle}>VERIFICATION & ACCESS WORKFLOW</Text>
                        <Text style={styles.flowDiagramSubtitle}>
                          Follow the progress of your {pendingApprovalData?.role ? pendingApprovalData.role.toLowerCase() : 'official'} credentials
                        </Text>
                      </View>

                      <View style={styles.flowStepsContainer}>
                        {/* Step 1 */}
                        <View style={styles.flowStepItem}>
                          <View style={[styles.flowStepIconCircle, styles.flowStepCompleted]}>
                            <Text style={styles.flowStepIcon}>📝</Text>
                            <View style={styles.flowStepCheckBadge}>
                              <Text style={styles.flowStepCheckText}>✓</Text>
                            </View>
                          </View>
                          <Text style={styles.flowStepNum}>STEP 1</Text>
                          <Text style={styles.flowStepLabel}>
                            {pendingApprovalData?.role?.includes('Umpire') ? 'Umpire Registration' : 'Scorer Registration'}
                          </Text>
                          <Text style={styles.flowStepStatusGreen}>Submitted</Text>
                        </View>

                        <View style={styles.flowArrowContainer}>
                          <Text style={styles.flowArrowText}>➔</Text>
                        </View>

                        {/* Step 2 */}
                        <View style={styles.flowStepItem}>
                          <View style={[styles.flowStepIconCircle, styles.flowStepActive]}>
                            <Text style={styles.flowStepIcon}>🛡️</Text>
                            <View style={styles.flowStepWaitBadge}>
                              <Text style={styles.flowStepWaitText}>⏳</Text>
                            </View>
                          </View>
                          <Text style={styles.flowStepNum}>STEP 2</Text>
                          <Text style={styles.flowStepLabel}>Admin Approval</Text>
                          <Text style={styles.flowStepStatusAmber}>In Review</Text>
                        </View>

                        <View style={styles.flowArrowContainer}>
                          <Text style={styles.flowArrowText}>➔</Text>
                        </View>

                        {/* Step 3 */}
                        <View style={styles.flowStepItem}>
                          <View style={[styles.flowStepIconCircle, styles.flowStepUpcoming]}>
                            <Text style={styles.flowStepIcon}>✉️</Text>
                          </View>
                          <Text style={styles.flowStepNum}>STEP 3</Text>
                          <Text style={styles.flowStepLabel}>Email Confirmation</Text>
                          <Text style={styles.flowStepStatusMuted}>Sent to Inbox</Text>
                        </View>

                        <View style={styles.flowArrowContainer}>
                          <Text style={styles.flowArrowText}>➔</Text>
                        </View>

                        {/* Step 4 */}
                        <View style={styles.flowStepItem}>
                          <View style={[styles.flowStepIconCircle, styles.flowStepUpcoming]}>
                            <Text style={styles.flowStepIcon}>🔑</Text>
                          </View>
                          <Text style={styles.flowStepNum}>STEP 4</Text>
                          <Text style={styles.flowStepLabel}>Portal Login</Text>
                          <Text style={styles.flowStepStatusMuted}>
                            {pendingApprovalData?.role?.includes('Umpire') ? 'Access Umpire' : 'Access Scorer'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Applicant Summary Card */}
                    {pendingApprovalData && (
                      <View style={styles.approvalDetailsCard}>
                        <View style={styles.approvalDetailRow}>
                          <Text style={styles.approvalDetailLabel}>Applicant Name:</Text>
                          <Text style={styles.approvalDetailVal}>{pendingApprovalData.name}</Text>
                        </View>
                        <View style={styles.approvalDetailRow}>
                          <Text style={styles.approvalDetailLabel}>Role / Category:</Text>
                          <Text style={styles.approvalDetailVal}>{pendingApprovalData.role}</Text>
                        </View>
                        {pendingApprovalData.certificationLevel && (
                          <View style={styles.approvalDetailRow}>
                            <Text style={styles.approvalDetailLabel}>Certification Level:</Text>
                            <Text style={[styles.approvalDetailVal, { color: '#f59e0b', fontWeight: '800' }]}>
                              🏅 {pendingApprovalData.certificationLevel}
                            </Text>
                          </View>
                        )}
                        {pendingApprovalData.taluk && (
                          <View style={styles.approvalDetailRow}>
                            <Text style={styles.approvalDetailLabel}>Jurisdiction / Taluk:</Text>
                            <Text style={styles.approvalDetailVal}>{pendingApprovalData.taluk}</Text>
                          </View>
                        )}
                        <View style={styles.approvalDetailRow}>
                          <Text style={styles.approvalDetailLabel}>Registered Email:</Text>
                          <Text style={styles.approvalDetailVal}>{pendingApprovalData.email}</Text>
                        </View>
                      </View>
                    )}

                    {/* Official English Notice Box */}
                    <View style={styles.approvalNoticeBox}>
                      <View style={styles.approvalNoticeHeaderRow}>
                        <Text style={styles.approvalNoticeHeaderIcon}>📢</Text>
                        <Text style={styles.approvalNoticeHeading}>District Administrator Verification Notice</Text>
                      </View>
                      <Text style={styles.approvalNoticeEnglish}>
                        Your registration application and certification documents have been submitted to the District Cricket Administrator (CFVD) for official verification.
                      </Text>
                      <Text style={[styles.approvalNoticeEnglish, { marginTop: 6, color: '#fde047' }]}>
                        Once the Administrator approves your profile, an official confirmation email will be dispatched to <Text style={{ fontWeight: '800' }}>{pendingApprovalData?.email || 'your email'}</Text>. Your account status will be set to ACTIVE, enabling immediate access to the Portal.
                      </Text>
                    </View>

                    {/* Action Button */}
                    <View style={styles.approvalActionRow}>
                      <TouchableOpacity
                        style={styles.approvalPrimaryBtn}
                        onPress={() => {
                          setShowApprovalPendingModal(false);
                          navigate('Login', { initialRole: activeRole });
                        }}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.approvalPrimaryBtnText}>
                          {pendingApprovalData?.role?.includes('Umpire')
                            ? 'Proceed to Umpire Login Portal →'
                            : 'Proceed to Scorer Login Portal →'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </View>
    );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', width: '100%', position: 'relative' },
  cornerExitBtn: {
    position: 'absolute',
    top: 14,
    left: 18,
    zIndex: 99,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#eab308',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5
  },
  cornerExitText: {
    color: '#eab308',
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.3
  },
  logoContainer: { alignItems: 'center', marginBottom: 8, marginTop: 4 },
  logo: { width: 44, height: 44, marginBottom: 2 },
  mainTitle: { color: '#1e293b', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  mainSubtitle: { color: '#b45309', fontSize: 15, fontWeight: '900', letterSpacing: 1 },
  scroll: { flexGrow: 1, width: '100%', justifyContent: 'center' },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: '100%'
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    width: '100%',
    maxWidth: 680,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 6
  },
  title: { color: '#1e293b', fontSize: 17, fontWeight: 'bold' },
  subtitle: { color: '#64748b', fontSize: 11, marginTop: 1 },

  statusBanner: { padding: 6, borderRadius: 6, marginBottom: 8, borderWidth: 1 },
  statusError: { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
  statusSuccess: { backgroundColor: '#f0fdf4', borderColor: '#86efac' },
  statusInfo: { backgroundColor: '#eff6ff', borderColor: '#93c5fd' },
  statusText: { fontSize: 11.5, fontWeight: '600', textAlign: 'center' },
  statusTextError: { color: '#b91c1c' },
  statusTextSuccess: { color: '#15803d' },
  statusTextInfo: { color: '#1d4ed8' },

  roleTabsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-end'
  },
  roleTab: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  roleTabActive: {
    backgroundColor: '#1e293b',
    borderColor: '#1e293b'
  },
  roleTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569'
  },
  roleTabTextActive: {
    color: '#ffffff',
    fontWeight: '800'
  },

  sectionHeaderBox: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 5,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#eab308'
  },
  sectionHeaderText: {
    color: '#0f172a',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.3
  },

  formRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6
  },
  label: { color: '#334155', fontSize: 11.5, marginBottom: 2, fontWeight: '700' },
  input: {
    backgroundColor: '#f8fafc',
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    fontSize: 12.5,
    height: 35
  },
  inputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2'
  },
  fieldErrorText: {
    color: '#dc2626',
    fontSize: 10.5,
    fontWeight: '700',
    marginTop: 2,
    marginBottom: 2
  },

  dropdownBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 10,
    height: 35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  dropdownText: {
    color: '#1e293b',
    fontSize: 12.5,
    fontWeight: '600',
    flex: 1
  },
  dropdownChevron: {
    color: '#64748b',
    fontSize: 13,
    marginLeft: 4,
    fontWeight: 'bold'
  },

  verifBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 8,
    marginVertical: 4
  },
  verifHelpText: {
    color: '#64748b',
    fontSize: 11,
    marginBottom: 6,
    lineHeight: 15
  },
  actionBtn: {
    backgroundColor: '#eab308',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignItems: 'center'
  },
  actionText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 11.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  verifyBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    height: 35
  },
  verifyBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold'
  },
  verifiedCard: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 6,
    padding: 6,
    alignItems: 'center'
  },
  verifiedCardText: {
    color: '#15803d',
    fontSize: 12,
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
    height: 35
  },
  passwordInput: {
    flex: 1,
    color: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12.5
  },
  toggleText: {
    fontSize: 13
  },
  btnDisabled: {
    opacity: 0.6
  },

  squadHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  squadSectionTitle: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700'
  },
  autoFillBtn: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4
  },
  autoFillBtnText: {
    color: '#1d4ed8',
    fontSize: 10.5,
    fontWeight: '800'
  },
  addPlayerContainer: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 8,
    borderRadius: 6,
    marginBottom: 6
  },
  addPlayerBtn: {
    backgroundColor: '#1e293b',
    height: 35,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center'
  },
  addPlayerBtnText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: '700'
  },
  playerListContainer: {
    marginBottom: 6,
    maxHeight: 120
  },
  playerItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 5,
    borderRadius: 5,
    marginBottom: 3
  },
  playerNumBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6
  },
  playerNumText: {
    fontSize: 10,
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
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0f172a'
  },
  playerItemRoleBadge: {
    backgroundColor: 'rgba(234, 179, 8, 0.2)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3
  },
  playerItemRoleText: {
    color: '#92400e',
    fontSize: 9.5,
    fontWeight: '800'
  },
  playerItemEmail: {
    fontSize: 10.5,
    color: '#64748b'
  },
  removeBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center'
  },
  removeBtnText: {
    color: '#ef4444',
    fontSize: 10,
    fontWeight: '900'
  },

  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
    gap: 8
  },
  checkbox: {
    width: 17,
    height: 17,
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
    fontSize: 10.5,
    fontWeight: 'bold'
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 11,
    color: '#475569',
    lineHeight: 15
  },

  submitBtn: {
    backgroundColor: '#eab308',
    paddingVertical: 9,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#eab308',
    shadowOffset: { width: 0, height: 2 },
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
    fontSize: 12.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },

  loginPromptRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  promptNormalText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '400'
  },
  loginLinkText: {
    color: '#b45309',
    fontSize: 12,
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
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 6
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a'
  },
  modalCloseBtn: {
    padding: 4
  },
  modalCloseBtnText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: 'bold'
  },
  modalList: {
    maxHeight: 280
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginVertical: 1.5
  },
  modalItemSelected: {
    backgroundColor: '#fef3c7'
  },
  modalItemText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500'
  },
  modalItemTextSelected: {
    color: '#92400e',
    fontWeight: '800'
  },
  modalCheckmark: {
    fontSize: 12,
    color: '#b45309',
    fontWeight: '900'
  },
  optionalToggleBtn: {
    backgroundColor: '#f8fafc',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
    alignItems: 'center'
  },
  optionalToggleText: {
    color: '#0284c7',
    fontSize: 11.5,
    fontWeight: '700'
  },
  optionalContainer: {
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8
  },

  // Cricket OTP Modal Styles (Virat Kohli Lord's Theme)
  cricketModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 20, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  cricketModalCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#eab308',
    backgroundColor: '#0f172a',
    shadowColor: '#eab308',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 12
  },
  cricketCardDesktop: {
    width: 780,
    maxWidth: '96%',
    height: 480
  },
  cricketCardMobile: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%'
  },
  cricketDesktopBg: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#0a0f1d'
  },
  cricketHeroImageContainer: {
    width: '44%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#0a0f1d'
  },
  cricketHeroFullImage: {
    width: '100%',
    height: '100%'
  },
  cricketHeroTag: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'rgba(5, 10, 25, 0.45)'
  },
  cricketHeroPill: {
    backgroundColor: 'rgba(234, 179, 8, 0.9)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 6
  },
  cricketHeroPillText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  cricketHeroHeading: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 4,
    textShadowOffset: { width: 1, height: 1 }
  },
  cricketHeroSubheading: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 4,
    textShadowOffset: { width: 1, height: 1 }
  },
  cricketRightPanel: {
    width: '56%',
    height: '100%',
    backgroundColor: 'rgba(10, 15, 29, 0.92)',
    paddingHorizontal: 22,
    paddingVertical: 18,
    justifyContent: 'space-between',
    borderLeftWidth: 1.5,
    borderLeftColor: 'rgba(234, 179, 8, 0.4)'
  },
  mobileHeroImageWrap: {
    width: '100%',
    height: 180,
    position: 'relative'
  },
  mobileHeroImage: {
    width: '100%',
    height: '100%'
  },
  mobileCloseCircle: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#eab308'
  },
  mobileHeroOverlayTag: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    backgroundColor: 'rgba(234, 179, 8, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4
  },
  mobileFormBody: {
    padding: 18,
    backgroundColor: '#0f172a'
  },
  popupTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  popupTag: {
    color: '#eab308',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 2
  },
  popupTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800'
  },
  popupCloseCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  popupCloseX: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: 'bold'
  },
  popupExplainer: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
    marginBottom: 6
  },
  popupInputGroup: {
    marginVertical: 4
  },
  popupInputLabel: {
    color: '#94a3b8',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  popupEmailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38
  },
  popupEmailIcon: {
    fontSize: 14,
    marginRight: 6
  },
  popupEmailInput: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600'
  },
  popupExpiryBadge: {
    color: '#eab308',
    fontSize: 10,
    fontWeight: '700'
  },
  popupOtpBox: {
    backgroundColor: '#1e293b',
    borderWidth: 1.5,
    borderColor: '#eab308',
    borderRadius: 8,
    height: 44,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '900',
    color: '#fbbf24',
    letterSpacing: 8
  },
  popupErrorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 6,
    padding: 6,
    marginVertical: 4
  },
  popupErrorMsg: {
    color: '#fca5a5',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center'
  },
  popupSuccessBox: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: '#22c55e',
    borderRadius: 6,
    padding: 6,
    marginVertical: 4
  },
  popupSuccessMsg: {
    color: '#86efac',
    fontSize: 11.5,
    fontWeight: '700',
    textAlign: 'center'
  },
  popupVerifyButton: {
    backgroundColor: '#eab308',
    borderRadius: 8,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#eab308',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5
  },
  popupBtnDisabled: {
    backgroundColor: '#475569',
    shadowOpacity: 0
  },
  popupVerifyButtonText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6
  },
  popupFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 6
  },
  popupFooterText: {
    color: '#94a3b8',
    fontSize: 11
  },
  popupResendAction: {
    color: '#eab308',
    fontSize: 11.5,
    fontWeight: '800',
    textDecorationLine: 'underline'
  },
  popupResendDisabled: {
    color: '#64748b',
    textDecorationLine: 'none'
  },

  // Official Admin Approval Pending Modal Styles
  approvalModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 20, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  approvalModalCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#eab308',
    shadowColor: '#eab308',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 15
  },
  approvalCardDesktop: {
    width: 860,
    maxWidth: '96%',
    height: 570,
    maxHeight: '92%'
  },
  approvalCardMobile: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '92%'
  },
  approvalDesktopContainer: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    height: '100%'
  },
  approvalHeroImageContainer: {
    width: '42%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#0a0f1d'
  },
  approvalHeroFullImage: {
    width: '100%',
    height: '100%'
  },
  approvalHeroTopOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: 'rgba(5, 12, 30, 0.65)'
  },
  approvalHeroBottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
    backgroundColor: 'rgba(5, 12, 30, 0.82)'
  },
  approvalHeroTitle: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 6
  },
  approvalHeroSubTitle: {
    color: '#fbbf24',
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  approvalHeroTitleMobile: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 4
  },
  approvalRightPanel: {
    flex: 1,
    width: '58%',
    height: '100%',
    backgroundColor: '#0f172a'
  },
  approvalRightScrollContent: {
    padding: 18
  },
  approvalTopBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  approvalStatusPill: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6
  },
  approvalStatusPillText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6
  },
  approvalCloseCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.3)'
  },
  approvalCloseX: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: 'bold'
  },
  approvalMobileHeroWrap: {
    width: '100%',
    height: 195,
    position: 'relative'
  },
  approvalMobileHeroImage: {
    width: '100%',
    height: '100%'
  },
  approvalMobileCloseCircle: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#eab308',
    zIndex: 10
  },
  approvalMobileTopOverlay: {
    position: 'absolute',
    top: 8,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(5, 12, 30, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  approvalMobileBottomOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    right: 10
  },
  approvalAppLogo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1.5,
    borderColor: '#f59e0b'
  },
  approvalFederationName: {
    color: '#f59e0b',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  approvalFederationSub: {
    color: '#cbd5e1',
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  approvalBadgePill: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    alignSelf: 'flex-start'
  },
  approvalBadgePillText: {
    color: '#000000',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  approvalBody: {
    padding: 16,
    backgroundColor: '#0f172a'
  },
  approvalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  approvalIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1e293b',
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center'
  },
  approvalIconText: {
    fontSize: 20
  },
  approvalMainHeading: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800'
  },
  approvalSubHeading: {
    color: '#f59e0b',
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 2
  },

  // 4-Step Flow Diagram Styles
  flowDiagramCard: {
    backgroundColor: '#131d31',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14
  },
  flowDiagramHeader: {
    marginBottom: 10,
    alignItems: 'center'
  },
  flowDiagramTitle: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  flowDiagramSubtitle: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1
  },
  flowStepsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  flowStepItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 2
  },
  flowStepIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 4
  },
  flowStepCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1.5,
    borderColor: '#10b981'
  },
  flowStepActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderWidth: 2,
    borderColor: '#f59e0b'
  },
  flowStepUpcoming: {
    backgroundColor: 'rgba(51, 65, 85, 0.45)',
    borderWidth: 1,
    borderColor: '#475569'
  },
  flowStepIcon: {
    fontSize: 16
  },
  flowStepCheckBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#10b981',
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center'
  },
  flowStepCheckText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900'
  },
  flowStepWaitBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#f59e0b',
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center'
  },
  flowStepWaitText: {
    fontSize: 8
  },
  flowStepNum: {
    color: '#64748b',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  flowStepLabel: {
    color: '#f8fafc',
    fontSize: 9.5,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 2
  },
  flowStepStatusGreen: {
    color: '#34d399',
    fontSize: 8.5,
    fontWeight: '800',
    marginTop: 2
  },
  flowStepStatusAmber: {
    color: '#fbbf24',
    fontSize: 8.5,
    fontWeight: '800',
    marginTop: 2
  },
  flowStepStatusMuted: {
    color: '#64748b',
    fontSize: 8.5,
    fontWeight: '600',
    marginTop: 2
  },
  flowArrowContainer: {
    paddingHorizontal: 2,
    marginBottom: 16
  },
  flowArrowText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '900'
  },

  // Applicant Summary Card
  approvalDetailsCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14,
    gap: 6
  },
  approvalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  approvalDetailLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600'
  },
  approvalDetailVal: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700'
  },

  // Official English Notice Box
  approvalNoticeBox: {
    backgroundColor: 'rgba(234, 179, 8, 0.10)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.35)',
    padding: 12,
    marginBottom: 16
  },
  approvalNoticeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4
  },
  approvalNoticeHeaderIcon: {
    fontSize: 14
  },
  approvalNoticeHeading: {
    color: '#fde047',
    fontSize: 12,
    fontWeight: '800'
  },
  approvalNoticeEnglish: {
    color: '#cbd5e1',
    fontSize: 11,
    lineHeight: 16
  },
  approvalActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end'
  },
  approvalPrimaryBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%'
  },
  approvalPrimaryBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5
  }
});
