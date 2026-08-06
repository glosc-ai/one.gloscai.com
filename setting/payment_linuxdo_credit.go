package setting

const LinuxDOCreditDefaultGateway = "https://credit.linux.do/epay"

var (
	LinuxDOCreditEnabled   bool
	LinuxDOCreditGateway   = LinuxDOCreditDefaultGateway
	LinuxDOCreditClientID  string
	LinuxDOCreditSecret    string
	LinuxDOCreditUnitPrice float64 = 1
	LinuxDOCreditMinTopUp          = 1
)
