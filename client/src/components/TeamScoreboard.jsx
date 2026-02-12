// src/components/TeamScoreboard.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Typography, Spin, Alert, Card, Row, Col, Button, Select,
    Divider, List, Tag, message, Avatar, Space, Tooltip, Form, Radio, Statistic
} from 'antd';
import { ArrowLeftOutlined, UserOutlined, PlusOutlined, UndoOutlined } from '@ant-design/icons'; // Added PlusOutlined & UndoOutlined
import axios from 'axios';

const { Title, Text } = Typography;
const { Option } = Select;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Helper function to get displayable player/team names
const getTeamName = (match, teamNumber) => {
    if (!match) return 'N/A';
    const teamData = teamNumber === 1 ? match.team1 : match.team2;
    return teamData?.name || `Team ${teamNumber}`;
};

// Helper function to convert setsToWin (1, 2, 3,7) to Best Of (1, 3, 5,7) for display
const setsToWinToBestOf = (sets) => {
    if (sets === 1) return 1;
    if (sets === 2) return 3;
    if (sets === 3) return 5;
    if (sets === 4) return 7;
    return 7;
};

// This function now renders the avatars for a specific pair of players ---
const renderCurrentPairAvatars = (players, isServing) => {
    const avatarSize = 80;

    const avatarContent = (player) => {
        if (!player) return null;
        const avatarSrc = player.photoUrl ? `${API_URL}${player.photoUrl}` : undefined;
        return (
            <Avatar key={player._id} size={avatarSize} src={avatarSrc} icon={!avatarSrc ? <UserOutlined /> : null}>
                {!avatarSrc ? player.name?.charAt(0)?.toUpperCase() : null}
            </Avatar>
        );
    };

    let avatarComponent;
    if (!players || players.length === 0) {
        avatarComponent = <Avatar size={avatarSize} icon={<UserOutlined />} />;
    } else if (players.length === 1) { // Singles
        avatarComponent = avatarContent(players[0]);
    } else { // Doubles
        avatarComponent = <Avatar.Group max={{ count: 2 }} size={avatarSize}>{players.map(p => avatarContent(p))}</Avatar.Group>;
    }

    if (isServing) {
        return (
            <Tooltip title="Serving">
                <span style={{ border: '3px solid #1677ff', borderRadius: '50%', display: 'inline-block', padding: '3px', lineHeight: 0 }}>
                    {avatarComponent}
                </span>
            </Tooltip>
        );
    }
    return avatarComponent;
};


const TeamScoreboard = () => {
    const { id: matchId } = useParams();
    const navigate = useNavigate();
    const [matchData, setMatchData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [formError, setFormError] = useState(null);
    const [isSubmittingPairs, setIsSubmittingPairs] = useState(false);
    const [isUpdatingScore, setIsUpdatingScore] = useState(false);
    const [isUndoing, setIsUndoing] = useState(false);
    const [pairSelectionForm] = Form.useForm();

    // Fetch match data
    useEffect(() => {
        if (!matchId) return;
        let isMounted = true;
        const fetchMatch = async () => {
            console.log(`TeamScoreboard: Fetching match ${matchId}`);
            setLoading(true); setError(null); setFormError(null); // Clear form error on new fetch
            try {
                const response = await axios.get(`${API_URL}/api/matches/${matchId}`);
                if (isMounted) {
                    setMatchData(response.data);
                    console.log("TeamScoreboard: Match data fetched:", response.data);
                    if (response.data?.status === 'Upcoming' || response.data?.status === 'AwaitingSetPairs') {
                        const nextSetIdx = response.data.score?.setDetails?.filter(s => s.status === 'Finished').length || 0;
                        // Set initial server for the form (can be changed by user)
                        const initialServerForForm = response.data.score?.server || 1;
                        pairSelectionForm.setFieldsValue({ initialServer: initialServerForForm, setIndex: nextSetIdx });
                        console.log(`TeamScoreboard: Initializing form for set index ${nextSetIdx}, server ${initialServerForForm}`);
                    }
                }
            } catch (err) {
                console.error("TeamScoreboard: Error fetching match data:", err);
                if (isMounted) { setError("Failed to load match data. Please try again."); }
            } finally {
                if (isMounted) { setLoading(false); }
            }
        };
        fetchMatch();
        return () => { isMounted = false; };
    }, [matchId, pairSelectionForm]);

    // Memoized calculations for current set, available players etc.
    const {
        currentSetIndex,
        availableTeam1Players,
        availableTeam2Players,
        encounterSize,
        playerSetCounts // Expose this for the label helper
    } = useMemo(() => {
        if (!matchData || !matchData.team1 || !matchData.team2) {
            return { currentSetIndex: 0, availableTeam1Players: [], availableTeam2Players: [], encounterSize: 1, playerSetCounts: new Map() };
        }

        const finishedSets = matchData.score?.setDetails?.filter(s => s.status === 'Finished') || [];
        const nextSetIdx = finishedSets.length;
        const encSize = matchData.teamMatchEncounterFormat === 'Singles' ? 1 : 2;

        const pSetCounts = new Map();
        finishedSets.forEach(detail => {
            const processPairInHistory = (pairObjects) => {
                const pairIds = (pairObjects || []).map(p => p?._id?.toString() || p?.toString()).filter(Boolean);
                if (pairIds.length === 0) return;
                pairIds.forEach(pId => {
                    pSetCounts.set(pId, (pSetCounts.get(pId) || 0) + 1);
                });
            };
            if (detail.team1Pair) processPairInHistory(detail.team1Pair);
            if (detail.team2Pair) processPairInHistory(detail.team2Pair);
        });

        const filterAvailable = (teamPlayers) => {
            if (!teamPlayers) return [];
            return teamPlayers.filter(player => {
                const playedSets = pSetCounts.get(player._id.toString()) || 0;
                // --- FIX: Use dynamic maxSetsPerPlayer from matchData ---
                return playedSets < (matchData.maxSetsPerPlayer || 2);
                // --------------------------------------------------------
            });
        };
        return {
            currentSetIndex: nextSetIdx,
            availableTeam1Players: filterAvailable(matchData.team1.players),
            availableTeam2Players: filterAvailable(matchData.team2.players),
            encounterSize: encSize,
            playerSetCounts: pSetCounts
        };
    }, [matchData]);


    // Handler for Submitting Selected Pairs
    const handleSetupSet = async (values) => {
        console.log("--- handleSetupSet CALLED ---");
        console.log("Form values received by handleSetupSet:", values);
        setIsSubmittingPairs(true);
        setFormError(null); // Clear previous form submission errors

        // Client-side validation (should match Form rules but good for direct calls)
        if (!values.team1PairIds || values.team1PairIds.length !== encounterSize) {
            message.error(`Team 1 must have ${encounterSize} player(s) selected.`);
            setIsSubmittingPairs(false); return;
        }
        if (!values.team2PairIds || values.team2PairIds.length !== encounterSize) {
            message.error(`Team 2 must have ${encounterSize} player(s) selected.`);
            setIsSubmittingPairs(false); return;
        }
        if (!values.initialServer) {
            message.error("Please select who serves first for this set.");
            setIsSubmittingPairs(false); return;
        }

        const payload = {
            setIndex: currentSetIndex,
            team1PairIds: values.team1PairIds,
            team2PairIds: values.team2PairIds,
            initialServer: values.initialServer
        };
        console.log("Submitting pairs for set with payload:", payload);

        // Client-side partner rule validation for Doubles
        if (matchData.teamMatchEncounterFormat === 'Doubles') {
            const checkPartnerRule = (pairIdsToSubmit) => {
                if (pairIdsToSubmit.length !== 2) return true; // Not a doubles pair
                const sortedSubmittedPairKey = [...pairIdsToSubmit].sort().join('-');
                let timesPlayedTogether = 0;
                (matchData.score?.setDetails || []).forEach(detail => {
                    if (detail.status === 'Finished') {
                        const checkFinishedPair = (finishedPairObjects) => {
                            const finishedPairIds = (finishedPairObjects || []).map(p => p?._id?.toString() || p?.toString()).filter(Boolean);
                            if (finishedPairIds.length === 2) {
                                const sortedFinishedPairKey = [...finishedPairIds].sort().join('-');
                                if (sortedFinishedPairKey === sortedSubmittedPairKey) {
                                    timesPlayedTogether++;
                                }
                            }
                        };
                        checkFinishedPair(detail.team1Pair);
                        checkFinishedPair(detail.team2Pair);
                    }
                });
                return timesPlayedTogether < 1; // Allow pair to play together only once
            };

            if (!checkPartnerRule(values.team1PairIds)) {
                message.error("The selected pair for Team 1 has already played together in a previous set.");
                setIsSubmittingPairs(false); return;
            }
            if (!checkPartnerRule(values.team2PairIds)) {
                message.error("The selected pair for Team 2 has already played together in a previous set.");
                setIsSubmittingPairs(false); return;
            }
        }

        try {
            const response = await axios.put(`${API_URL}/api/matches/${matchId}/setup_set`, payload);
            console.log("API response from /setup_set:", response.data);
            setMatchData(response.data);
            pairSelectionForm.resetFields(); // Reset form fields
            // Re-initialize form for next set if applicable (after setMatchData updates currentSetIndex)
            // This might be better done in a useEffect that watches currentSetIndex and matchData.status
            message.success(`Set ${currentSetIndex + 1} started!`);
        } catch (error) {
            console.error("Error setting up set (Frontend):", error.response?.data || error.message || error);
            const errorMsg = error.response?.data?.message || "Failed to start set. Please check selections.";
            setFormError(errorMsg); // Set form-specific error
            message.error(errorMsg);
        } finally {
            console.log("Setting isSubmittingPairs to false.");
            setIsSubmittingPairs(false);
        }
    };

    // --- Live Scoring and Undo Handlers ---
    const handleScoreUpdate = async (scoringTeam) => {
        if (isUpdatingScore || matchData?.status !== 'Live' || isUndoing) return;
        setIsUpdatingScore(true);
        try {
            const response = await axios.put(`${API_URL}/api/matches/${matchId}/score`, { scoringTeam });
            setMatchData(response.data);
            if (response.data.status !== 'Live') {
                message.info(`Set finished. Current overall score: ${response.data.score.currentSetScore.team1}-${response.data.score.currentSetScore.team2}`);
            }
            if (response.data.status === 'Finished') {
                let finalWinnerName = 'N/A';
                const winnerIdentifier = response.data.winner;
                if (response.data.matchType === 'Individual') { finalWinnerName = winnerIdentifier === response.data.player1?._id ? getTeamName(response.data, 1) : getTeamName(response.data, 2); }
                else { finalWinnerName = winnerIdentifier === 1 ? getTeamName(response.data, 1) : getTeamName(response.data, 2); }
                message.success(`Match finished! Winner: ${finalWinnerName}`);
            }
        } catch (error) {
            console.error("Error updating score:", error.response?.data || error.message);
            message.error(error.response?.data?.message || "Failed to update score.");
        } finally {
            setIsUpdatingScore(false);
        }
    };

    const handleUndo = async () => {
        if (isUndoing || isUpdatingScore || matchData?.status !== 'Live' || !matchData?.pointHistory?.length) {
            message.warning("Cannot undo point right now.");
            return;
        }
        setIsUndoing(true);
        try {
            const response = await axios.put(`${API_URL}/api/matches/${matchId}/undo`);
            setMatchData(response.data); // Update state with reverted data
            message.success('Last point undone.');
        } catch (error) {
            console.error("Error undoing point:", error.response?.data || error.message);
            message.error(error.response?.data?.message || "Failed to undo point.");
        } finally {
            setIsUndoing(false);
        }
    };
    // ---------------------------------------------------------



    // --- Loading, Error, and No Data Render States ---
    if (loading) {
        return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" tip="Loading Team Scoreboard..." /></div>;
    }
    if (error && !isSubmittingPairs) {
        return (<div style={{ padding: 20 }}> <Alert message="Error" description={error} type="error" showIcon /> <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/team-matches')} style={{ marginTop: 16 }}> Back to Team Matches </Button> </div>);
    }
    if (!matchData && !loading) {
        return (<div style={{ padding: 20 }}> <Alert message="Team Match data not found." type="warning" showIcon /> <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/team-matches')} style={{ marginTop: 16 }}> Back to Team Matches </Button> </div>);
    }

    // Prepare display variables from matchData
    const status = matchData?.status;
    const isAwaitingPairs = status === 'Upcoming' || status === 'AwaitingSetPairs' || status === 'AwaitingTiebreakerPairs';
    const isLive = status === 'Live';
    const isFinished = status === 'Finished';
    const canUndo = isLive && matchData?.pointHistory?.length > 0;

    // --- UI for Pair Selection ---
    const renderPairSelectionForm = () => {
        const nextSetNumber = currentSetIndex + 1;
        const setLabel = status === 'AwaitingTiebreakerPairs' ? 'Tiebreaker Set' : `Set ${nextSetNumber}`;
        const getPlayerLabel = (player) => {
            const playedCount = playerSetCounts.get(player._id.toString()) || 0;
            const maxSets = matchData?.maxSetsPerPlayer || 2;
            const remaining = maxSets - playedCount;
            return `${player.name} (${remaining} set${remaining !== 1 ? 's' : ''} left)`;
        };

        return (
            <Card title={<Title level={4}>Select Pairs for {setLabel}</Title>} style={{ marginTop: 20 }}>
                {formError && <Alert message="Error Starting Set" description={formError} type="error" showIcon closable onClose={() => setFormError(null)} style={{ marginBottom: 16 }} />}
                <Form
                    form={pairSelectionForm}
                    layout="vertical"
                    onFinish={handleSetupSet}
                    onFinishFailed={(errorInfo) => {
                        console.log('Pair Selection Form - VALIDATION FAILED:', errorInfo);
                        message.error('Please correct the form errors.');
                    }}
                    initialValues={{ initialServer: 1 }}
                >
                    <Row gutter={24}>
                        <Col xs={24} md={12}>
                            <Title level={5}>{getTeamName(matchData, 1)}</Title>
                            <Form.Item
                                name="team1PairIds"
                                label={`Select ${encounterSize} Player(s)`}
                                rules={[{
                                    required: true, type: 'array', len: encounterSize,
                                    message: `Please select exactly ${encounterSize} player(s).`
                                }]}
                            >
                                <Select
                                    mode="multiple"
                                    maxCount={encounterSize}   // 1 for single, 2 for double
                                    placeholder={`Select player${encounterSize > 1 ? "s" : ""}`}
                                    allowClear
                                    options={availableTeam1Players.map(p => ({
                                        value: p._id,
                                        label: getPlayerLabel(p)
                                    }))}
                                    filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                                    showSearch
                                />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Title level={5}>{getTeamName(matchData, 2)}</Title>
                            <Form.Item
                                name="team2PairIds"
                                label={`Select ${encounterSize} Player(s)`}
                                rules={[{
                                    required: true, type: 'array', len: encounterSize,
                                    message: `Please select exactly ${encounterSize} player(s).`
                                }]}
                            >
                                <Select
                                    mode="multiple"
                                    maxCount={encounterSize}   // 1 for single, 2 for double
                                    placeholder={`Select player${encounterSize > 1 ? "s" : ""}`}
                                    allowClear
                                    options={availableTeam2Players.map(p => ({ value: p._id, label: getPlayerLabel(p) }))}
                                    filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                                    showSearch
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="initialServer" label="Who Serves First in this Set?"
                        rules={[{ required: true, message: "Please select who serves first." }]}>
                        <Radio.Group>
                            <Radio value={1}>{getTeamName(matchData, 1)}</Radio>
                            <Radio value={2}>{getTeamName(matchData, 2)}</Radio>
                        </Radio.Group>
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={isSubmittingPairs} block>
                            Confirm Pairs & Start {setLabel}
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
        );
    };

    // --- Main Scoreboard Display (Live scoring UI) ---
    const renderLiveScoreboard = () => {
        const currentLiveSetDetail = matchData.score?.setDetails?.find(s => s.status === 'Live');
        if (!currentLiveSetDetail) {
            return <Alert message="Waiting for next set..." type="info" showIcon />;
        }

        const team1PlayingPair = currentLiveSetDetail.team1Pair || [];
        const team2PlayingPair = currentLiveSetDetail.team2Pair || [];
        const team1PlayingNames = team1PlayingPair.map(p => p.name).join(' & ');
        const team2PlayingNames = team2PlayingPair.map(p => p.name).join(' & ');
        const isLiveFinished = matchData.status === 'Finished';

        return (
            <Card title={<Title level={4} style={{ textAlign: 'center' }}>Live Scoring</Title>} style={{ marginTop: 20 }}>
                <Title level={5} style={{ textAlign: 'center' }}>Set {currentSetIndex + 1}: {team1PlayingNames} vs {team2PlayingNames}</Title>
                <Row justify="space-around" align="top" gutter={[16, 24]} style={{ marginBottom: 24, textAlign: 'center' }}>
                    <Col xs={24} sm={10}>
                        <Space direction="vertical" align="center" size="middle">
                            {renderCurrentPairAvatars(team1PlayingPair, matchData.score.server === 1)}
                            <Title level={4} style={{ marginBottom: 0, marginTop: 8 }}>{getTeamName(matchData, 1)}</Title>
                            <Statistic title="Overall Sets" value={matchData.score?.currentSetScore?.team1 ?? 0} />
                        </Space>
                    </Col>
                    <Col xs={24} sm={4} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold', minHeight: '150px' }}>vs</Col>
                    <Col xs={24} sm={10}>
                        <Space direction="vertical" align="center" size="middle">
                            {renderCurrentPairAvatars(team2PlayingPair, matchData.score.server === 2)}
                            <Title level={4} style={{ marginBottom: 0, marginTop: 8 }}>{getTeamName(matchData, 2)}</Title>
                            <Statistic title="Overall Sets" value={matchData.score?.currentSetScore?.team2 ?? 0} />
                        </Space>
                    </Col>
                </Row>
                <Divider>Current Game in Set {currentSetIndex + 1}</Divider>
                <Row justify="space-around" align="middle" gutter={[16, 16]} style={{ marginBottom: 24, textAlign: 'center' }}>
                    <Col xs={24} md={10}>
                        <Statistic value={matchData.score?.currentGame?.team1 ?? 0} valueStyle={{ fontSize: '3.5rem' }} />
                        {!isLiveFinished && (<Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => handleScoreUpdate(1)} loading={isUpdatingScore || isUndoing} disabled={isUndoing} style={{ marginTop: 8 }} block>Point Team 1</Button>)}
                    </Col>
                    <Col xs={0} md={4} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3.5rem', color: '#aaa' }}>-</Col>
                    <Col xs={24} md={10}>
                        <Statistic value={matchData.score?.currentGame?.team2 ?? 0} valueStyle={{ fontSize: '3.5rem' }} />
                        {!isLiveFinished && (<Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => handleScoreUpdate(2)} loading={isUpdatingScore || isUndoing} disabled={isUndoing} style={{ marginTop: 8 }} block>Point Team 2</Button>)}
                    </Col>
                </Row>
                {matchData.score?.setDetails && matchData.score.setDetails.filter(s => s.status === 'Finished').length > 0 && (
                    <>
                        <Divider>Completed Sets</Divider>
                        <List
                            size="small"
                            bordered
                            dataSource={matchData.score.setDetails.filter(s => s.status === 'Finished')}
                            renderItem={(set, index) => (
                                <List.Item>
                                    <Text strong style={{ marginRight: 'auto' }}>Set {index + 1}:</Text>
                                    <Text>{set.team1Score} - {set.team2Score}</Text>
                                </List.Item>
                            )}
                            style={{ maxWidth: 300, margin: '24px auto 0 auto' }}
                        />
                    </>
                )}
            </Card>
        );
    };

    // --- Finished Match Display ---
    const renderFinishedMatch = () => { /* ... same as before ... */ };

    // --- Main Return for TeamScoreboard ---
    return (
        <Card>
            <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
                <Col>
                    <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/team-matches')}> Back to Team Matches </Button>
                </Col>
                <Col>
                    <Button
                        icon={<UndoOutlined />}
                        onClick={handleUndo}
                        disabled={!canUndo || isUpdatingScore || isUndoing}
                        loading={isUndoing}
                    >
                        Undo Last Point
                    </Button>
                </Col>
            </Row>
            <Title level={3} style={{ textAlign: 'center' }}>Team Match Scoreboard</Title>
            <Text block style={{ textAlign: 'center', marginBottom: 8 }}>Match ID: {matchId}</Text>
            <Tag color="blue" style={{ display: 'block', textAlign: 'center', marginBottom: 24, fontSize: '1rem' }}> Status: {status} </Tag>

            {isAwaitingPairs && renderPairSelectionForm()}
            {isLive && renderLiveScoreboard()}
            {isFinished && renderFinishedMatch()}

            <Divider>Debug: Raw Match Data</Divider>
            <pre style={{ fontSize: '0.8em', background: '#f5f5f5', padding: '10px', borderRadius: '4px', marginTop: 20, maxHeight: 300, overflowY: 'auto' }}>
                {JSON.stringify(matchData, null, 2)}
            </pre>
        </Card>
    );
};

export default TeamScoreboard;