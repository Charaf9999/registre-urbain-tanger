// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

contract UrbanIssueRegistry {
    enum Status { Reported, Assigned, InProgress, Resolved, Closed }
    enum Priority { Low, Medium, High }
    enum Action { Created, Imported, TeamAssigned, StatusChanged }

    struct Record {
        string issueId;
        string issueType;
        string location;
        string description;
        uint32 reportDay; // Jours UTC depuis le 01/01/1970, date déclarée.
        Priority priority;
        string reportedBy; // Pseudonyme fictif, distinct de l'adresse signataire.
        string assignedTo;
        Status status;
    }
    struct Entry {
        uint64 timestamp;
        address actor;
        Action action;
        Status status;
        string team;
        string comment;
    }

    address public immutable municipality;
    uint256 public constant MAX_BATCH = 10;
    string[] private ids;
    uint256[5] public countByStatus;
    mapping(bytes32 => Record) private issues;
    mapping(bytes32 => Entry[]) private journal;

    event IssueRecorded(bytes32 indexed key, string issueId, address indexed actor, bool imported, Status status);
    event TeamAssigned(bytes32 indexed key, address indexed actor, string team, Status status, string comment);
    event StatusChanged(bytes32 indexed key, address indexed actor, Status status, string comment);

    constructor() { municipality = msg.sender; }
    modifier municipal() {
        require(msg.sender == municipality, "Municipality only");
        _;
    }
    function issueCount() external view returns (uint256) { return ids.length; }
    function idAt(uint256 index) external view returns (string memory) { return ids[index]; }
    function exists(string calldata id) external view returns (bool) {
        return journal[keccak256(bytes(id))].length != 0;
    }
    function getIssue(string calldata id) external view returns (Record memory) {
        return issues[_known(id)];
    }
    function getHistory(string calldata id) external view returns (Entry[] memory) {
        return journal[_known(id)];
    }
    function createIssue(Record calldata row) external {
        require(row.status == Status.Reported && bytes(row.assignedTo).length == 0, "New issue must be unassigned");
        _record(row, false);
    }
    function importIssues(Record[] calldata rows) external {
        require(rows.length > 0 && rows.length <= MAX_BATCH, "Batch size 1..10");
        for (uint256 i; i < rows.length; ++i) {
            Record calldata row = rows[i];
            if (row.status != Status.Reported || bytes(row.assignedTo).length != 0) {
                require(msg.sender == municipality, "Municipality only");
            }
            if (row.status != Status.Reported) require(_text(row.assignedTo, 64), "Team required");
            _record(row, true);
        }
    }
    function assignTeam(string calldata id, string calldata team, string calldata comment) external municipal {
        bytes32 key = _known(id);
        Record storage row = issues[key];
        require(row.status <= Status.InProgress, "Assignment finished");
        require(_text(team, 64) && _text(comment, 240), "Team/comment invalid");
        row.assignedTo = team;
        if (row.status == Status.Reported) {
            --countByStatus[uint8(Status.Reported)];
            ++countByStatus[uint8(Status.Assigned)];
            row.status = Status.Assigned;
        }
        _log(key, Action.TeamAssigned, comment);
        emit TeamAssigned(key, msg.sender, team, row.status, comment);
    }
    function updateStatus(string calldata id, Status next, string calldata comment) external municipal {
        bytes32 key = _known(id);
        Record storage row = issues[key];
        require(row.status >= Status.Assigned && uint8(next) == uint8(row.status) + 1, "Invalid transition");
        require(_text(comment, 240), "Comment required");
        --countByStatus[uint8(row.status)];
        ++countByStatus[uint8(next)];
        row.status = next;
        _log(key, Action.StatusChanged, comment);
        emit StatusChanged(key, msg.sender, next, comment);
    }
    function _record(Record calldata row, bool imported) private {
        require(_validId(bytes(row.issueId)), "Invalid ID");
        bytes32 key = keccak256(bytes(row.issueId));
        require(journal[key].length == 0, "Duplicate ID");
        require(_text(row.issueType, 64) && _text(row.location, 120), "Type/location invalid");
        require(_text(row.description, 280) && _text(row.reportedBy, 64), "Description/alias invalid");
        require(bytes(row.assignedTo).length == 0 || _text(row.assignedTo, 64), "Invalid team");
        require(row.reportDay >= 10957 && row.reportDay < 47482, "Date outside 2000..2099");
        issues[key] = row;
        ++countByStatus[uint8(row.status)];
        ids.push(row.issueId);
        _log(key, imported ? Action.Imported : Action.Created, "");
        emit IssueRecorded(key, row.issueId, msg.sender, imported, row.status);
    }
    function _known(string calldata id) private view returns (bytes32 key) {
        key = keccak256(bytes(id));
        require(journal[key].length != 0, "Unknown ID");
    }
    function _log(bytes32 key, Action action, string memory comment) private {
        Record storage row = issues[key];
        journal[key].push(Entry(uint64(block.timestamp), msg.sender, action, row.status, row.assignedTo, comment));
    }
    function _text(string calldata value, uint256 max) private pure returns (bool) {
        bytes calldata data = bytes(value);
        if (data.length == 0 || data.length > max) return false;
        for (uint256 i; i < data.length; ++i) if (uint8(data[i]) > 32) return true;
        return false;
    }
    function _validId(bytes memory data) private pure returns (bool) {
        if (data.length == 0 || data.length > 32) return false;
        for (uint256 i; i < data.length; ++i) {
            uint8 c = uint8(data[i]);
            if (!((c >= 65 && c <= 90) || (c >= 48 && c <= 57) || c == 45)) return false;
        }
        return true;
    }
}
